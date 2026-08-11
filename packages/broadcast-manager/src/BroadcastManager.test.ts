/**
 * BroadcastManager tests — Tasks 4.3, 4.4, 4.5, 4.6
 *
 * All FFmpeg processes mocked via ProcessSpawner.
 * All timers controlled via vitest fake timers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import type { ChildProcess } from 'node:child_process';
import { EventBus, VOLLYCAST_EVENTS } from '@vollycast/shared';
import type { BroadcastEventPayload } from '@vollycast/shared';
import type { ProcessSpawner } from '@vollycast/stream-engine';
import { BroadcastManager } from './BroadcastManager.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeKey(): string {
  return randomBytes(32).toString('hex');
}

/** Creates a fake ChildProcess that stays running until killed */
function makeFakeProcess(autoExitCode?: number | null): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  (emitter as unknown as Record<string, unknown>)['killed'] = false;
  (emitter as unknown as Record<string, unknown>)['pid'] = 12345;
  (emitter as unknown as Record<string, unknown>)['stdin'] = null;
  (emitter as unknown as Record<string, unknown>)['stdout'] = null;
  (emitter as unknown as Record<string, unknown>)['stderr'] = null;
  (emitter as unknown as Record<string, unknown>)['stdio'] = [null, null, null];

  const kill = vi.fn((signal?: string): boolean => {
    if (signal !== 'SIGKILL') {
      setImmediate(() => emitter.emit('exit', 0));
    }
    return true;
  });
  (emitter as unknown as Record<string, unknown>)['kill'] = kill;

  if (autoExitCode !== undefined) {
    setImmediate(() => emitter.emit('exit', autoExitCode));
  }

  return emitter;
}

function makeSpawner(autoExitCode?: number | null): ProcessSpawner {
  return {
    spawn: vi.fn(() => makeFakeProcess(autoExitCode)),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BroadcastManager', () => {
  let bus: EventBus;
  let manager: BroadcastManager;

  beforeEach(() => {
    vi.useFakeTimers();
    EventBus.resetForTesting();
    bus = EventBus.getInstance();
    manager = new BroadcastManager({
      eventBus: bus,
      spawner: makeSpawner(),
      encryptionKey: makeKey(),
      reconnectDelayMs: 100,
      maxReconnectAttempts: 3,
    });
  });

  afterEach(() => {
    manager.stop();
    vi.useRealTimers();
    EventBus.resetForTesting();
  });

  // ── Initial state ───────────────────────────────────────────────────────────

  it('starts in idle status', () => {
    expect(manager.getStatus()).toBe('idle');
  });

  it('isLive() is false initially', () => {
    expect(manager.isLive()).toBe(false);
  });

  it('getPlatform() is null initially', () => {
    expect(manager.getPlatform()).toBeNull();
  });

  // ── start() ─────────────────────────────────────────────────────────────────

  it('sets status to live after start()', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    expect(manager.getStatus()).toBe('live');
  });

  it('isLive() returns true after start()', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    expect(manager.isLive()).toBe(true);
  });

  it('getPlatform() returns correct platform after start()', () => {
    manager.start({
      platform: 'facebook',
      streamKey: 'fb-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    expect(manager.getPlatform()).toBe('facebook');
  });

  it('emits BROADCAST_STARTED event', () => {
    const handler = vi.fn();
    bus.on<BroadcastEventPayload>(VOLLYCAST_EVENTS.BROADCAST_STARTED, handler);

    manager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ platform: 'youtube', status: 'live' });
  });

  it('throws if start() called while already live', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'key1',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    expect(() =>
      manager.start({
        platform: 'youtube',
        streamKey: 'key2',
        inputUrl: 'rtmp://localhost:1935/live/cam1',
      }),
    ).toThrow('already active');
  });

  it('works with custom platform and custom RTMP URL', () => {
    manager.start({
      platform: 'custom',
      streamKey: 'mykey',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      customRtmpUrl: 'rtmp://myserver.com/live',
    });
    expect(manager.getStatus()).toBe('live');
    expect(manager.getPlatform()).toBe('custom');
  });

  // ── stop() ──────────────────────────────────────────────────────────────────

  it('sets status to stopped after stop()', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    manager.stop();
    expect(manager.getStatus()).toBe('stopped');
  });

  it('isLive() returns false after stop()', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    manager.stop();
    expect(manager.isLive()).toBe(false);
  });

  it('emits BROADCAST_STOPPED event on stop()', () => {
    const handler = vi.fn();
    bus.on<BroadcastEventPayload>(VOLLYCAST_EVENTS.BROADCAST_STOPPED, handler);

    manager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    manager.stop();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ platform: 'youtube', status: 'stopped' });
  });

  it('stop() is safe to call when idle', () => {
    expect(() => manager.stop()).not.toThrow();
  });

  it('getPlatform() returns null after stop()', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    manager.stop();
    expect(manager.getPlatform()).toBeNull();
  });

  // ── Reconnect (auto-reconnect with exponential backoff) ────────────────────

  it('emits BROADCAST_RECONNECTING when stream exits unexpectedly', async () => {
    const reconnectHandler = vi.fn();

    // Use real timers for this test — setImmediate from fake process needs to run
    vi.useRealTimers();

    const bus2 = EventBus.getInstance();
    bus2.on<BroadcastEventPayload>(VOLLYCAST_EVENTS.BROADCAST_RECONNECTING, reconnectHandler);

    const errorSpawner = makeSpawner(1);
    const reconnectManager = new BroadcastManager({
      eventBus: bus2,
      spawner: errorSpawner,
      encryptionKey: makeKey(),
      reconnectDelayMs: 50,
      maxReconnectAttempts: 3,
    });

    reconnectManager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });

    // Wait for the process to exit and reconnect to be scheduled
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    expect(reconnectHandler).toHaveBeenCalled();
    expect(reconnectHandler.mock.calls[0]?.[0]).toMatchObject({
      platform: 'youtube',
      status: 'reconnecting',
    });

    reconnectManager.stop();
  });

  it('stops after max reconnect attempts are exhausted', async () => {
    vi.useRealTimers();

    const bus2 = EventBus.getInstance();
    const errorSpawner = makeSpawner(1);
    const reconnectManager = new BroadcastManager({
      eventBus: bus2,
      spawner: errorSpawner,
      encryptionKey: makeKey(),
      reconnectDelayMs: 30,
      maxReconnectAttempts: 2,
    });

    reconnectManager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });

    // Each attempt: process spawns, exits (setImmediate ~1ms), then delay fires
    // attempt 1: 30ms, attempt 2: 60ms, plus process exit time per attempt
    // Total: ~500ms with generous buffer
    await new Promise<void>((resolve) => setTimeout(resolve, 800));

    expect(reconnectManager.getStatus()).toBe('stopped');
    reconnectManager.stop();
  });

  it('cancels pending reconnect when stop() is called', async () => {
    const reconnectHandler = vi.fn();
    bus.on<BroadcastEventPayload>(VOLLYCAST_EVENTS.BROADCAST_RECONNECTING, reconnectHandler);

    const errorSpawner = makeSpawner(1);
    const reconnectManager = new BroadcastManager({
      eventBus: bus,
      spawner: errorSpawner,
      encryptionKey: makeKey(),
      reconnectDelayMs: 5000,
      maxReconnectAttempts: 3,
    });

    reconnectManager.start({
      platform: 'youtube',
      streamKey: 'test-key',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });

    // Let the stream fail and schedule reconnect
    await vi.runAllTimersAsync();

    // Stop before reconnect timer fires
    reconnectManager.stop();

    expect(reconnectManager.getStatus()).toBe('stopped');
  });

  // ── Security ────────────────────────────────────────────────────────────────

  it('stream key is not exposed in getStatus() or getPlatform()', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'SECRET_STREAM_KEY_DO_NOT_LOG',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });

    // These public methods must not return the stream key
    expect(String(manager.getStatus())).not.toContain('SECRET_STREAM_KEY_DO_NOT_LOG');
    expect(String(manager.getPlatform())).not.toContain('SECRET_STREAM_KEY_DO_NOT_LOG');
  });

  it('BROADCAST_STARTED payload does not contain stream key', () => {
    const handler = vi.fn();
    bus.on<BroadcastEventPayload>(VOLLYCAST_EVENTS.BROADCAST_STARTED, handler);

    manager.start({
      platform: 'youtube',
      streamKey: 'SECRET_STREAM_KEY',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });

    const payload = handler.mock.calls[0]?.[0] as BroadcastEventPayload;
    expect(JSON.stringify(payload)).not.toContain('SECRET_STREAM_KEY');
  });

  // ── Can restart after stop ───────────────────────────────────────────────────

  it('can start again after stop()', () => {
    manager.start({
      platform: 'youtube',
      streamKey: 'key1',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
    });
    manager.stop();

    expect(() =>
      manager.start({
        platform: 'facebook',
        streamKey: 'key2',
        inputUrl: 'rtmp://localhost:1935/live/cam1',
      }),
    ).not.toThrow();

    expect(manager.getStatus()).toBe('live');
    expect(manager.getPlatform()).toBe('facebook');
  });
});
