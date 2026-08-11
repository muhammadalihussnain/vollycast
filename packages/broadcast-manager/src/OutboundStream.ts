/**
 * OutboundStream — Task 4.3
 *
 * Wraps a single FFmpeg process that pushes a local RTMP stream
 * to an external platform (YouTube, Facebook, custom).
 *
 * FFmpeg command:
 *   ffmpeg -re -i <inputUrl> -c copy -f flv <outputUrl>
 *
 * Memory leak prevention:
 * - FfmpegProcess reference cleared on stop
 * - onExit/onError callbacks forwarded to caller
 */

import { FfmpegProcess } from '@vollycast/stream-engine';
import type { ProcessSpawner } from '@vollycast/stream-engine';
import { logger } from './logger.js';

export interface OutboundStreamOptions {
  /** Unique ID for this outbound stream (used for logging) */
  readonly id: string;
  /** Local RTMP input URL (from nginx) */
  readonly inputUrl: string;
  /** Full external RTMP push URL including stream key */
  readonly outputUrl: string;
  /** FFmpeg binary path — defaults to 'ffmpeg' */
  readonly ffmpegBin?: string;
  /** Injectable spawner for testing */
  readonly spawner?: ProcessSpawner;
  /** Called when the stream exits cleanly */
  onExit?: (id: string) => void;
  /** Called when the stream exits with an error */
  onError?: (id: string, code: number | null) => void;
}

/** Builds the FFmpeg args for re-streaming (copy codec, no re-encode) */
function buildArgs(inputUrl: string, outputUrl: string): readonly string[] {
  return [
    '-re',
    '-i', inputUrl,
    '-c', 'copy',
    '-f', 'flv',
    outputUrl,
  ];
}

export class OutboundStream {
  private process: FfmpegProcess | null = null;
  private readonly options: OutboundStreamOptions;

  public constructor(options: OutboundStreamOptions) {
    this.options = options;
  }

  /**
   * Start pushing the stream to the external platform.
   * Throws if already running.
   */
  public start(): void {
    if (this.process !== null) {
      throw new Error(`OutboundStream already running: ${this.options.id}`);
    }

    const args = buildArgs(this.options.inputUrl, this.options.outputUrl);

    const procOptions = {
      id: this.options.id,
      args,
      ffmpegBin: this.options.ffmpegBin ?? 'ffmpeg',
      onExit: (id: string): void => {
        this.process = null;
        logger.info({ id }, 'Outbound stream exited cleanly');
        this.options.onExit?.(id);
      },
      onError: (id: string, code: number | null): void => {
        this.process = null;
        logger.warn({ id, code }, 'Outbound stream exited with error');
        this.options.onError?.(id, code);
      },
    };

    this.process =
      this.options.spawner !== undefined
        ? new FfmpegProcess(procOptions, this.options.spawner)
        : new FfmpegProcess(procOptions);

    this.process.start();
    logger.info({ id: this.options.id }, 'Outbound stream started');
  }

  /**
   * Stop the outbound stream gracefully.
   * Safe to call if not running.
   */
  public stop(): void {
    if (this.process === null) return;
    this.process.stop();
    this.process = null;
    logger.info({ id: this.options.id }, 'Outbound stream stopped');
  }

  /** Whether the stream is currently running. */
  public isRunning(): boolean {
    return this.process !== null && this.process.isRunning();
  }
}
