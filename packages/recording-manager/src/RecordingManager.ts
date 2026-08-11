/**
 * RecordingManager — Tasks 6.1, 6.2, 6.3, 6.5, 6.6
 *
 * Manages all recording sessions per camera per match/set.
 * Design patterns:
 * - Observer: reacts to CAMERA_CONNECTED/DISCONNECTED, MATCH_STARTED/COMPLETED, SET_COMPLETED
 * - Repository: sessions stored in Map by camera ID
 * - Factory: createSession() builds sessions consistently
 */

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import {
  EventBus,
  VOLLYCAST_EVENTS,
  type CameraId,
  type RecordingSegment,
  type CameraEventPayload,
} from '@vollycast/shared';
import { RecordingSession } from './RecordingSession.js';
import type { SessionSpawner } from './RecordingSession.js';
import { DiskMonitor } from './DiskMonitor.js';
import { logger } from './logger.js';

export interface RecordingManagerOptions {
  readonly recordingsPath: string;
  readonly ffmpegBin?: string;
  readonly eventBus?: EventBus;
  readonly spawner?: SessionSpawner;
  /** Injectable mkdir for testing */
  readonly mkdirFn?: (path: string) => Promise<void>;
  /** Injectable DiskMonitor for testing */
  readonly diskMonitor?: DiskMonitor;
}

export class RecordingManager {
  private readonly sessions: Map<CameraId, RecordingSession> = new Map();
  private readonly completedSegments: RecordingSegment[] = [];
  private readonly recordingsPath: string;
  private readonly ffmpegBin: string;
  private readonly bus: EventBus;
  private readonly spawner: SessionSpawner | undefined;
  private readonly mkdirFn: (path: string) => Promise<void>;
  private readonly diskMonitor: DiskMonitor;
  private readonly unsubscribers: Array<() => void> = [];

  private activeMatchId: string | null = null;
  private activeSet: number = 1;

  public constructor(options: RecordingManagerOptions) {
    this.recordingsPath = options.recordingsPath;
    this.ffmpegBin = options.ffmpegBin ?? /* c8 ignore next */ 'ffmpeg';
    this.bus = options.eventBus ?? /* c8 ignore next */ EventBus.getInstance();
    this.spawner = options.spawner;
    /* c8 ignore next 3 */
    this.mkdirFn = options.mkdirFn ?? ((path: string): Promise<void> =>
      mkdir(path, { recursive: true }).then(() => undefined));
    /* c8 ignore next 3 */
    this.diskMonitor = options.diskMonitor ?? new DiskMonitor({
      recordingsPath: options.recordingsPath,
      eventBus: this.bus,
    });
  }

  /**
   * Start listening to system events and disk monitoring.
   */
  public start(): void {
    const unsubCameraConnect = this.bus.on<CameraEventPayload>(
      VOLLYCAST_EVENTS.CAMERA_CONNECTED,
      ({ camera }): void => {
        if (this.activeMatchId !== null) {
          void this.startRecording(camera.id, camera.streamUrl);
        }
      },
    );

    const unsubCameraDisconnect = this.bus.on<CameraEventPayload>(
      VOLLYCAST_EVENTS.CAMERA_DISCONNECTED,
      ({ camera }): void => {
        this.stopRecording(camera.id);
      },
    );

    const unsubMatchStart = this.bus.on<{ matchId: string }>(
      VOLLYCAST_EVENTS.MATCH_STARTED,
      ({ matchId }): void => {
        this.activeMatchId = matchId;
        this.activeSet = 1;
        logger.info({ matchId }, 'Recording manager: match started');
      },
    );

    const unsubSetComplete = this.bus.on<{ matchId: string; setNumber: number }>(
      VOLLYCAST_EVENTS.SET_COMPLETED,
      ({ setNumber }): void => {
        this.activeSet = setNumber + 1;
        logger.info({ setNumber }, 'Recording manager: set completed, new set started');
      },
    );

    const unsubMatchEnd = this.bus.on(
      VOLLYCAST_EVENTS.MATCH_COMPLETED,
      (): void => {
        this.stopAllRecordings();
        this.activeMatchId = null;
        logger.info({}, 'Recording manager: match completed, all recordings stopped');
      },
    );

    this.unsubscribers.push(
      unsubCameraConnect,
      unsubCameraDisconnect,
      unsubMatchStart,
      unsubSetComplete,
      unsubMatchEnd,
    );

    this.diskMonitor.start();
    logger.info({}, 'Recording manager started');
  }

  /**
   * Stop all recordings, unsubscribe events, stop disk monitor.
   */
  public stop(): void {
    this.stopAllRecordings();

    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;

    this.diskMonitor.stop();
    logger.info({}, 'Recording manager stopped');
  }

  /**
   * Manually start recording for a camera.
   */
  public async startRecording(cameraId: CameraId, inputUrl: string): Promise<RecordingSegment> {
    if (this.sessions.has(cameraId)) {
      throw new Error(`Recording already active for camera: ${cameraId}`);
    }

    const matchId = this.activeMatchId ?? 'no-match';
    const dir = join(this.recordingsPath, matchId);
    await this.mkdirFn(dir);

    const filename = `set${this.activeSet}-${cameraId}-${Date.now()}.mp4`;
    const outputPath = join(dir, filename);

    const sessionOptions = {
      matchId,
      cameraId,
      setNumber: this.activeSet,
      inputUrl,
      outputPath,
      ffmpegBin: this.ffmpegBin,
      onStop: (id: string): void => { this.handleSessionStop(id); },
      onError: (id: string): void => { this.handleSessionError(id); },
    };

    const session = this.spawner !== undefined
      ? new RecordingSession(sessionOptions, this.spawner)
      : /* c8 ignore next */ new RecordingSession(sessionOptions);

    session.start();
    this.sessions.set(cameraId, session);

    this.bus.emit(VOLLYCAST_EVENTS.RECORDING_STARTED, { segment: session.segment });
    logger.info({ cameraId, outputPath }, 'Recording started');

    return { ...session.segment };
  }

  /**
   * Manually stop recording for a camera.
   */
  public stopRecording(cameraId: CameraId): RecordingSegment | null {
    const session = this.sessions.get(cameraId);
    if (session === undefined) return null;

    const segment = session.stop();
    this.sessions.delete(cameraId);
    this.completedSegments.push(segment);
    this.bus.emit(VOLLYCAST_EVENTS.RECORDING_STOPPED, { segment });
    return segment;
  }

  /** Number of active recording sessions. */
  public activeCount(): number {
    return this.sessions.size;
  }

  /** All completed recording segments. */
  public getCompletedSegments(): RecordingSegment[] {
    return [...this.completedSegments];
  }

  /** Whether a camera is currently being recorded. */
  public isRecording(cameraId: CameraId): boolean {
    return this.sessions.get(cameraId)?.isRecording() ?? false;
  }

  private stopAllRecordings(): void {
    for (const [cameraId] of this.sessions) {
      this.stopRecording(cameraId);
    }
  }

  private handleSessionStop(sessionId: string): void {
    this.removeSessionById(sessionId);
  }

  private handleSessionError(sessionId: string): void {
    this.removeSessionById(sessionId);
  }

  private removeSessionById(sessionId: string): void {
    for (const [cameraId, session] of this.sessions) {
      if (session.id === sessionId) {
        this.sessions.delete(cameraId);
        break;
      }
    }
  }
}
