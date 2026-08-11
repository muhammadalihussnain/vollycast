/**
 * RecordingSession — represents one active FFmpeg recording process.
 *
 * Memory leak prevention:
 * - Process reference cleared after stop
 * - Listeners removed on cleanup
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { RecordingSegment, CameraId } from '@vollycast/shared';
import { logger } from './logger.js';

export type SessionStatus = 'recording' | 'stopped' | 'error';

export interface RecordingSessionOptions {
  readonly matchId: string;
  readonly cameraId: CameraId;
  readonly setNumber: number;
  readonly inputUrl: string;
  readonly outputPath: string;
  readonly ffmpegBin?: string;
  onStop?: (id: string) => void;
  onError?: (id: string) => void;
}

/** Injectable spawner for testing */
export interface SessionSpawner {
  spawn(command: string, args: string[]): ChildProcess;
}

export const defaultSessionSpawner: SessionSpawner = {
  /* c8 ignore next 3 */
  spawn(command: string, args: string[]): ChildProcess {
    return spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  },
};

export class RecordingSession {
  public readonly id: string;
  public readonly segment: RecordingSegment;
  private process: ChildProcess | null = null;
  private _status: SessionStatus = 'recording';
  private readonly options: RecordingSessionOptions;
  private readonly spawner: SessionSpawner;

  public constructor(options: RecordingSessionOptions, spawner: SessionSpawner = defaultSessionSpawner) {
    this.id = randomUUID();
    this.options = options;
    this.spawner = spawner;
    this.segment = {
      id: this.id,
      matchId: options.matchId,
      cameraId: options.cameraId,
      filePath: options.outputPath,
      startedAt: new Date(),
    };
  }

  public get status(): SessionStatus {
    return this._status;
  }

  /** Start the FFmpeg recording process. */
  public start(): void {
    const bin = this.options.ffmpegBin ?? 'ffmpeg';
    const args = [
      '-i', this.options.inputUrl,
      '-c', 'copy',
      '-f', 'mp4',
      this.options.outputPath,
    ];

    this.process = this.spawner.spawn(bin, args);

    this.process.on('exit', (code): void => {
      this.cleanup();
      if (code === 0 || this._status === 'stopped') {
        this._status = 'stopped';
        this.options.onStop?.(this.id);
      } else {
        this._status = 'error';
        logger.error({ sessionId: this.id, exitCode: code }, 'Recording session error');
        this.options.onError?.(this.id);
      }
    });

    this.process.on('error', (): void => {
      this._status = 'error';
      this.cleanup();
      this.options.onError?.(this.id);
    });

    logger.info({ sessionId: this.id, cameraId: this.options.cameraId }, 'Recording started');
  }

  /** Stop the recording gracefully. */
  public stop(): RecordingSegment {
    if (this.process !== null && this._status === 'recording') {
      this._status = 'stopped';
      this.process.kill('SIGTERM');
      this.cleanup();
    }
    const completed: RecordingSegment = { ...this.segment, completedAt: new Date() };
    logger.info({ sessionId: this.id }, 'Recording stopped');
    return completed;
  }

  public isRecording(): boolean {
    return this._status === 'recording';
  }

  private cleanup(): void {
    if (this.process !== null) {
      this.process.removeAllListeners();
      this.process = null;
    }
  }
}
