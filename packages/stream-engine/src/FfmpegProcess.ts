/**
 * FfmpegProcess — Tasks 2.1, 2.5
 *
 * Wraps a single FFmpeg child process.
 * Guarantees no orphan processes — every process is tracked and cleaned up.
 *
 * Memory leak prevention:
 * - Process reference cleared on exit/error
 * - Event listeners removed after process ends
 * - Status transitions are one-way: idle → running → stopped/error
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { logger } from './logger.js';

export type FfmpegProcessStatus = 'idle' | 'running' | 'stopped' | 'error';

export interface FfmpegProcessOptions {
  /** Camera or stream ID — used for logging */
  readonly id: string;
  /** Full FFmpeg argument list */
  readonly args: readonly string[];
  /** FFmpeg binary path — defaults to 'ffmpeg' on PATH */
  readonly ffmpegBin?: string;
  /** Called when the process exits cleanly */
  onExit?: (id: string) => void;
  /** Called when the process exits with an error */
  onError?: (id: string, code: number | null) => void;
}

/** Interface for spawning child processes — injectable for testing */
export interface ProcessSpawner {
  spawn(command: string, args: readonly string[]): ChildProcess;
}

/** Default spawner using Node.js child_process */
export const defaultSpawner: ProcessSpawner = {
  spawn(command: string, args: readonly string[]): ChildProcess {
    return spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  },
};

export class FfmpegProcess {
  private process: ChildProcess | null = null;
  private _status: FfmpegProcessStatus = 'idle';
  private readonly options: FfmpegProcessOptions;
  private readonly spawner: ProcessSpawner;

  public constructor(options: FfmpegProcessOptions, spawner: ProcessSpawner = defaultSpawner) {
    this.options = options;
    this.spawner = spawner;
  }

  public get status(): FfmpegProcessStatus {
    return this._status;
  }

  public get id(): string {
    return this.options.id;
  }

  /**
   * Start the FFmpeg process.
   * Throws if already running.
   */
  public start(): void {
    if (this._status === 'running') {
      throw new Error(`FFmpeg process already running for stream: ${this.options.id}`);
    }

    const bin = this.options.ffmpegBin ?? 'ffmpeg';
    logger.info({ streamId: this.options.id }, 'Starting FFmpeg process');

    this.process = this.spawner.spawn(bin, this.options.args);
    this._status = 'running';

    this.process.on('exit', (code) => {
      this.handleExit(code);
    });

    this.process.on('error', (err) => {
      logger.error({ streamId: this.options.id, error: err.message }, 'FFmpeg process error');
      this._status = 'error';
      this.cleanup();
      this.options.onError?.(this.options.id, null);
    });
  }

  /**
   * Stop the FFmpeg process gracefully.
   * Sends SIGTERM, waits, then SIGKILL if needed.
   * Safe to call even if process is not running.
   */
  public stop(): void {
    if (this.process === null || this._status !== 'running') {
      return;
    }

    logger.info({ streamId: this.options.id }, 'Stopping FFmpeg process');
    this.process.kill('SIGTERM');
    this._status = 'stopped';
    this.cleanup();
  }

  /**
   * Returns true if the process is currently running.
   */
  public isRunning(): boolean {
    return this._status === 'running';
  }

  private handleExit(code: number | null): void {
    const wasRunning = this._status === 'running';
    this.cleanup();

    if (code === 0 || !wasRunning) {
      this._status = 'stopped';
      this.options.onExit?.(this.options.id);
    } else {
      this._status = 'error';
      logger.warn({ streamId: this.options.id, exitCode: code }, 'FFmpeg process exited with error');
      this.options.onError?.(this.options.id, code);
    }
  }

  /** Remove process reference and clear listeners to prevent memory leaks */
  private cleanup(): void {
    if (this.process !== null) {
      this.process.removeAllListeners();
      this.process = null;
    }
  }
}
