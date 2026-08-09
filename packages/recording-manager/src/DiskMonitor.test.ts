import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiskMonitor } from './DiskMonitor.js';
import { EventBus, VOLLYCAST_EVENTS, RECORDING } from '@vollycast/shared';
import type { DiskSpacePayload } from '@vollycast/shared';

const BYTES_PER_GB = 1_073_741_824;

function makeStatfs(usedPercent: number): () => Promise<{ bsize: number; bavail: number; blocks: number }> {
  return (): Promise<{ bsize: number; bavail: number; blocks: number }> => {
    const blocks = 1000;
    const bsize = BYTES_PER_GB;
    const usedBlocks = Math.floor(blocks * (usedPercent / 100));
    const bavail = blocks - usedBlocks;
    return Promise.resolve({ bsize, bavail, blocks });
  };
}

describe('DiskMonitor', () => {
  let monitor: DiskMonitor;
  let bus: EventBus;

  beforeEach(() => {
    EventBus.resetForTesting();
    bus = EventBus.getInstance();
  });

  afterEach(() => {
    monitor.stop();
    EventBus.resetForTesting();
  });

  it('check() returns correct usedPercent', async () => {
    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(50),
    });
    const result = await monitor.check();
    expect(result.usedPercent).toBeCloseTo(50, 0);
  });

  it('check() returns correct freeGb', async () => {
    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(20),
    });
    const result = await monitor.check();
    expect(result.freeGb).toBeGreaterThan(0);
  });

  it('emits DISK_SPACE_WARNING when usage exceeds warning threshold', async () => {
    const warnings: DiskSpacePayload[] = [];
    bus.on<DiskSpacePayload>(VOLLYCAST_EVENTS.DISK_SPACE_WARNING, (p) => warnings.push(p));

    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(RECORDING.DISK_WARNING_THRESHOLD_PERCENT),
    });

    await monitor.check();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.usedPercent).toBeGreaterThanOrEqual(RECORDING.DISK_WARNING_THRESHOLD_PERCENT);
  });

  it('does not emit warning when disk usage is below threshold', async () => {
    const warnings: DiskSpacePayload[] = [];
    bus.on<DiskSpacePayload>(VOLLYCAST_EVENTS.DISK_SPACE_WARNING, (p) => warnings.push(p));

    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(50),
    });

    await monitor.check();
    expect(warnings).toHaveLength(0);
  });

  it('emits warning when usage is above critical threshold', async () => {
    const warnings: DiskSpacePayload[] = [];
    bus.on<DiskSpacePayload>(VOLLYCAST_EVENTS.DISK_SPACE_WARNING, (p) => warnings.push(p));

    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(RECORDING.DISK_CRITICAL_THRESHOLD_PERCENT),
    });

    await monitor.check();
    expect(warnings).toHaveLength(1);
  });

  it('start() and stop() do not throw', () => {
    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(50),
      checkIntervalMs: 50000,
    });
    expect(() => { monitor.start(); monitor.stop(); }).not.toThrow();
  });

  it('start() is idempotent', () => {
    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(50),
      checkIntervalMs: 50000,
    });
    monitor.start();
    monitor.start(); // second call no-op
    monitor.stop();
  });

  it('stop() is safe when not started', () => {
    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(50),
    });
    expect(() => monitor.stop()).not.toThrow();
  });

  it('fires check periodically when started', async () => {
    const warnings: DiskSpacePayload[] = [];
    bus.on<DiskSpacePayload>(VOLLYCAST_EVENTS.DISK_SPACE_WARNING, (p) => warnings.push(p));

    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: makeStatfs(90),
      checkIntervalMs: 30,
    });

    monitor.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
    monitor.stop();

    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('handles zero total disk (edge case) without throwing', async () => {
    monitor = new DiskMonitor({
      recordingsPath: '/recordings',
      eventBus: bus,
      statfsFn: (): Promise<{ bsize: number; bavail: number; blocks: number }> =>
        Promise.resolve({ bsize: 0, bavail: 0, blocks: 0 }),
    });
    const result = await monitor.check();
    expect(result.usedPercent).toBe(0);
  });
});
