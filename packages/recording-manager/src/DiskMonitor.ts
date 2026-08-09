/**
 * DiskMonitor — Task 6.4
 *
 * Monitors available disk space and emits warnings/critical alerts.
 * Design pattern: Observer — emits events through EventBus.
 *
 * Memory leak prevention: timer cleared on stop().
 */

import { statfs } from 'node:fs/promises';
import {
  EventBus,
  VOLLYCAST_EVENTS,
  RECORDING,
  type DiskSpacePayload,
} from '@vollycast/shared';
import { logger } from './logger.js';

/** Bytes per gigabyte */
const BYTES_PER_GB = 1_073_741_824;

/** Multiplier to convert a ratio to a percentage */
const PERCENT = 100;

/** Check interval — every 30 seconds */
const CHECK_INTERVAL_MS = 30_000;

export interface DiskMonitorOptions {
  readonly recordingsPath: string;
  readonly checkIntervalMs?: number;
  readonly eventBus?: EventBus;
  /** Injectable statfs for testing */
  readonly statfsFn?: (path: string) => Promise<{ bsize: number; bavail: number; blocks: number }>;
}

export class DiskMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly recordingsPath: string;
  private readonly checkIntervalMs: number;
  private readonly bus: EventBus;
  private readonly statfsFn: (path: string) => Promise<{ bsize: number; bavail: number; blocks: number }>;

  public constructor(options: DiskMonitorOptions) {
    this.recordingsPath = options.recordingsPath;
    this.checkIntervalMs = options.checkIntervalMs ?? CHECK_INTERVAL_MS;
    this.bus = options.eventBus ?? EventBus.getInstance();
    this.statfsFn = options.statfsFn ?? /* c8 ignore next */ statfs;
  }

  /** Start periodic disk checks. */
  public start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval((): void => {
      void this.check();
    }, this.checkIntervalMs);
  }

  /** Stop and clean up timer. */
  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run a single disk space check — also callable directly. */
  public async check(): Promise<DiskSpacePayload> {
    const stats = await this.statfsFn(this.recordingsPath);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * PERCENT : 0;
    const freeGb = freeBytes / BYTES_PER_GB;

    const payload: DiskSpacePayload = { usedPercent, freeGb };

    if (usedPercent >= RECORDING.DISK_WARNING_THRESHOLD_PERCENT) {
      this.bus.emit(VOLLYCAST_EVENTS.DISK_SPACE_WARNING, payload);
      logger.warn({ usedPercent, freeGb }, 'Disk space warning');
    }

    return payload;
  }
}
