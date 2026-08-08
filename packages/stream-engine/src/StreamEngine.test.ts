import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { StreamEngine } from './StreamEngine.js';
import { EventBus, VOLLYCAST_EVENTS } from '@vollycast/shared';
import type { CameraEventPayload, StreamHealthPayload } from '@vollycast/shared';
import type { ChildProcess } from 'node:child_process';
import type { ProcessSpawner } from './FfmpegProcess.js';

function makeFakeProcess(): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  emitter.kill = vi.fn().mockReturnValue(true);
  emitter.stdin = null;
  emitter.stdout = null;
  emitter.stderr = null;
  return emitter;
}

function makeFakeSpawner(): { spawner: ProcessSpawner; lastProc: () => ChildProcess } {
  let last: ChildProcess = makeFakeProcess();
  const spawner: ProcessSpawner = {
    spawn: vi.fn().mockImplementation(() => {
      last = makeFakeProcess();
      return last;
    }),
  };
  return { spawner, lastProc: () => last };
}

describe('StreamEngine', () => {
  let engine: StreamEngine;
  let bus: EventBus;
  let spawner: ProcessSpawner;

  beforeEach(() => {
    EventBus.resetForTesting();
    bus = EventBus.getInstance();
    const fake = makeFakeSpawner();
    spawner = fake.spawner;
    engine = new StreamEngine({
      eventBus: bus,
      spawner,
      healthIntervalMs: 50,
      rtmpHost: 'localhost',
      rtmpPort: 1935,
    });
  });

  afterEach(() => {
    engine.stop();
    EventBus.resetForTesting();
  });

  // ─── start / stop lifecycle ───────────────────────────────────────────────────

  it('starts with zero active streams', () => {
    expect(engine.activeStreamCount()).toBe(0);
  });

  it('stop() is safe when no streams are running', () => {
    expect(() => engine.stop()).not.toThrow();
  });

  // ─── startStream / stopStream ─────────────────────────────────────────────────

  it('startStream creates a running stream', () => {
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');
    expect(engine.isStreaming('cam-1')).toBe(true);
    expect(engine.activeStreamCount()).toBe(1);
  });

  it('startStream skips duplicate — same camera cannot start twice', () => {
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');
    expect(engine.activeStreamCount()).toBe(1);
    expect(spawner.spawn).toHaveBeenCalledTimes(1);
  });

  it('stopStream removes the stream', () => {
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');
    engine.stopStream('cam-1');
    expect(engine.isStreaming('cam-1')).toBe(false);
    expect(engine.activeStreamCount()).toBe(0);
  });

  it('stopStream is safe for unknown camera', () => {
    expect(() => engine.stopStream('no-such-cam')).not.toThrow();
  });

  it('manages multiple streams independently', () => {
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');
    engine.startStream('cam-2', 'rtmp://localhost/live/cam2');
    expect(engine.activeStreamCount()).toBe(2);
    engine.stopStream('cam-1');
    expect(engine.activeStreamCount()).toBe(1);
    expect(engine.isStreaming('cam-2')).toBe(true);
  });

  // ─── event-driven behavior ────────────────────────────────────────────────────

  it('starts stream when CAMERA_CONNECTED event fires', () => {
    engine.start();

    const payload: CameraEventPayload = {
      camera: { id: 'cam-1', name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1', status: 'active' },
    };
    bus.emit(VOLLYCAST_EVENTS.CAMERA_CONNECTED, payload);

    expect(engine.isStreaming('cam-1')).toBe(true);
  });

  it('stops stream when CAMERA_DISCONNECTED event fires', () => {
    engine.start();

    const connectPayload: CameraEventPayload = {
      camera: { id: 'cam-1', name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1', status: 'active' },
    };
    bus.emit(VOLLYCAST_EVENTS.CAMERA_CONNECTED, connectPayload);
    expect(engine.isStreaming('cam-1')).toBe(true);

    const disconnectPayload: CameraEventPayload = {
      camera: { id: 'cam-1', name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1', status: 'disconnected' },
    };
    bus.emit(VOLLYCAST_EVENTS.CAMERA_DISCONNECTED, disconnectPayload);
    expect(engine.isStreaming('cam-1')).toBe(false);
  });

  it('stop() unsubscribes from events — no reaction after stop', () => {
    engine.start();
    engine.stop();

    const payload: CameraEventPayload = {
      camera: { id: 'cam-1', name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1', status: 'active' },
    };
    bus.emit(VOLLYCAST_EVENTS.CAMERA_CONNECTED, payload);

    expect(engine.isStreaming('cam-1')).toBe(false);
  });

  it('stop() stops all running streams', () => {
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');
    engine.startStream('cam-2', 'rtmp://localhost/live/cam2');
    engine.stop();
    expect(engine.activeStreamCount()).toBe(0);
  });

  // ─── health metrics ────────────────────────────────────────────────────────────

  it('emits STREAM_HEALTH events for active streams', async () => {
    const healthEvents: StreamHealthPayload[] = [];
    bus.on<StreamHealthPayload>(VOLLYCAST_EVENTS.STREAM_HEALTH, (p) => healthEvents.push(p));

    engine.start();
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(healthEvents.length).toBeGreaterThanOrEqual(1);
    expect(healthEvents[0]?.health.cameraId).toBe('cam-1');
  });

  it('does not emit health events when no streams are active', async () => {
    const healthEvents: StreamHealthPayload[] = [];
    bus.on<StreamHealthPayload>(VOLLYCAST_EVENTS.STREAM_HEALTH, (p) => healthEvents.push(p));

    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(healthEvents).toHaveLength(0);
  });

  // ─── quality profile ──────────────────────────────────────────────────────────

  it('setProfile changes the profile', () => {
    engine.setProfile('high');
    // Start a stream — it should use the new profile (spawner gets called with high bitrate args)
    engine.startStream('cam-1', 'rtmp://localhost/live/cam1');
    const spawnArgs = (spawner.spawn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string[]];
    expect(spawnArgs[1]).toContain('5000k');
  });

  it('isStreaming returns false for unknown camera', () => {
    expect(engine.isStreaming('unknown-cam')).toBe(false);
  });

  // ─── process lifecycle cleanup ────────────────────────────────────────────────

  it('stream is removed from map when FFmpeg process exits cleanly', () => {
    const { spawner: sp, lastProc } = makeFakeSpawner();
    const eng = new StreamEngine({ eventBus: bus, spawner: sp, healthIntervalMs: 50000 });

    eng.startStream('cam-1', 'rtmp://localhost/live/cam1');
    expect(eng.activeStreamCount()).toBe(1);

    // Simulate FFmpeg exiting cleanly
    lastProc().emit('exit', 0);
    expect(eng.activeStreamCount()).toBe(0);
    eng.stop();
  });

  it('stream is removed from map when FFmpeg process errors', () => {
    const { spawner: sp, lastProc } = makeFakeSpawner();
    const eng = new StreamEngine({ eventBus: bus, spawner: sp, healthIntervalMs: 50000 });

    eng.startStream('cam-1', 'rtmp://localhost/live/cam1');
    lastProc().emit('exit', 1);
    expect(eng.activeStreamCount()).toBe(0);
    eng.stop();
  });
});
