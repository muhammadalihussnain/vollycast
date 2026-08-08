/**
 * StreamEngine — Tasks 2.3, 2.4, 2.6
 *
 * Manages the full transcoding pipeline per camera:
 * - Starts/stops FFmpeg processes per camera
 * - Applies quality profiles (Strategy pattern)
 * - Emits stream health metrics
 * - Listens to camera events and reacts automatically
 *
 * Design patterns:
 * - Strategy: quality profiles via QualityStrategy
 * - Observer: reacts to CAMERA_CONNECTED/DISCONNECTED via EventBus
 * - Repository: FfmpegProcess instances stored in a Map by cameraId
 */

import {
  EventBus,
  VOLLYCAST_EVENTS,
  NETWORK,
  type QualityProfile,
  type CameraId,
  type CameraEventPayload,
  type StreamHealthPayload,
} from '@vollycast/shared';
import { FfmpegProcess } from './FfmpegProcess.js';
import { createQualityStrategy, buildFfmpegArgs } from './QualityStrategy.js';
import type { ProcessSpawner } from './FfmpegProcess.js';
import { logger } from './logger.js';

/** Builds the RTMP output URL for a given camera on the local nginx server */
function buildOutputUrl(cameraId: CameraId, rtmpHost: string, rtmpPort: number): string {
  return `rtmp://${rtmpHost}:${rtmpPort}/live/${cameraId}`;
}

export interface StreamEngineOptions {
  /** Default quality profile for all streams */
  defaultProfile?: QualityProfile;
  /** RTMP host for output streams */
  rtmpHost?: string;
  /** RTMP port for output streams */
  rtmpPort?: number;
  /** FFmpeg binary path */
  ffmpegBin?: string;
  /** Injected EventBus — defaults to singleton */
  eventBus?: EventBus;
  /** Injected process spawner — allows testing without real FFmpeg */
  spawner?: ProcessSpawner;
  /** Health metrics emit interval in ms */
  healthIntervalMs?: number;
}

export class StreamEngine {
  private readonly processes: Map<CameraId, FfmpegProcess> = new Map();
  private readonly profile: QualityProfile;
  private readonly rtmpHost: string;
  private readonly rtmpPort: number;
  private readonly ffmpegBin: string;
  private readonly bus: EventBus;
  private readonly spawner: ProcessSpawner | undefined;
  private readonly healthIntervalMs: number;

  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private readonly unsubscribers: Array<() => void> = [];

  public constructor(options: StreamEngineOptions = {}) {
    this.profile = options.defaultProfile ?? 'medium';
    this.rtmpHost = options.rtmpHost ?? 'localhost';
    this.rtmpPort = options.rtmpPort ?? NETWORK.RTMP_PORT;
    this.ffmpegBin = options.ffmpegBin ?? 'ffmpeg';
    this.bus = options.eventBus ?? EventBus.getInstance();
    this.spawner = options.spawner;
    this.healthIntervalMs = options.healthIntervalMs ?? NETWORK.HEALTH_CHECK_INTERVAL_MS;
  }

  /**
   * Start the engine — subscribe to camera events and begin health reporting.
   */
  public start(): void {
    const unsubConnect = this.bus.on<CameraEventPayload>(
      VOLLYCAST_EVENTS.CAMERA_CONNECTED,
      ({ camera }) => {
        this.startStream(camera.id, camera.streamUrl);
      },
    );

    const unsubDisconnect = this.bus.on<CameraEventPayload>(
      VOLLYCAST_EVENTS.CAMERA_DISCONNECTED,
      ({ camera }) => {
        this.stopStream(camera.id);
      },
    );

    this.unsubscribers.push(unsubConnect, unsubDisconnect);

    this.healthTimer = setInterval(() => {
      this.emitHealthMetrics();
    }, this.healthIntervalMs);

    logger.info({}, 'Stream engine started');
  }

  /**
   * Stop the engine — stop all streams, clear timers, remove event listeners.
   * Always call this on shutdown to prevent leaks.
   */
  public stop(): void {
    // Stop health timer
    if (this.healthTimer !== null) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    // Unsubscribe from all events
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;

    // Stop all running streams
    for (const [id, proc] of this.processes) {
      proc.stop();
      logger.info({ cameraId: id }, 'Stream stopped on engine shutdown');
    }
    this.processes.clear();

    logger.info({}, 'Stream engine stopped');
  }

  /**
   * Manually start a stream for a camera.
   * Called automatically when CAMERA_CONNECTED fires.
   */
  public startStream(cameraId: CameraId, inputUrl: string): void {
    if (this.processes.has(cameraId)) {
      logger.warn({ cameraId }, 'Stream already running — skipping duplicate start');
      return;
    }

    const outputUrl = buildOutputUrl(cameraId, this.rtmpHost, this.rtmpPort);
    const strategy = createQualityStrategy(this.profile);
    const args = buildFfmpegArgs(inputUrl, outputUrl, strategy);

    const processOptions = {
      id: cameraId,
      args,
      ffmpegBin: this.ffmpegBin,
      onExit: (id: CameraId) => {
        this.processes.delete(id);
        logger.info({ cameraId: id }, 'Stream exited cleanly');
      },
      onError: (id: CameraId, code: number | null) => {
        this.processes.delete(id);
        logger.error({ cameraId: id, exitCode: code }, 'Stream exited with error');
      },
    };

    const proc = this.spawner !== undefined
      ? new FfmpegProcess(processOptions, this.spawner)
      : new FfmpegProcess(processOptions);

    proc.start();
    this.processes.set(cameraId, proc);
    logger.info({ cameraId, inputUrl, outputUrl, profile: this.profile }, 'Stream started');
  }

  /**
   * Manually stop a stream for a camera.
   * Called automatically when CAMERA_DISCONNECTED fires.
   */
  public stopStream(cameraId: CameraId): void {
    const proc = this.processes.get(cameraId);
    if (proc === undefined) {
      return;
    }
    proc.stop();
    this.processes.delete(cameraId);
    logger.info({ cameraId }, 'Stream stopped');
  }

  /**
   * Change quality profile for all future streams.
   * Does not affect currently running streams.
   */
  public setProfile(profile: QualityProfile): void {
    (this as { profile: QualityProfile }).profile = profile;
    logger.info({ profile }, 'Quality profile updated');
  }

  /**
   * Returns the number of currently active streams.
   */
  public activeStreamCount(): number {
    return this.processes.size;
  }

  /**
   * Returns true if a stream is running for the given camera.
   */
  public isStreaming(cameraId: CameraId): boolean {
    return this.processes.get(cameraId)?.isRunning() ?? false;
  }

  /** Emit health metrics for all active streams */
  private emitHealthMetrics(): void {
    for (const [cameraId] of this.processes) {
      const payload: StreamHealthPayload = {
        health: {
          cameraId,
          bitrateKbps: 0,   // populated by future metrics collection
          droppedFrames: 0,
          latencyMs: 0,
          timestamp: new Date(),
        },
      };
      this.bus.emit(VOLLYCAST_EVENTS.STREAM_HEALTH, payload);
    }
  }
}
