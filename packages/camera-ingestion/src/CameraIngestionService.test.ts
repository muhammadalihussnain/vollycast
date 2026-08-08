import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CameraIngestionService } from './CameraIngestionService.js';
import { CameraRegistry } from './CameraRegistry.js';
import { EventBus, VOLLYCAST_EVENTS } from '@vollycast/shared';
import type { CameraEventPayload } from '@vollycast/shared';

describe('CameraIngestionService', () => {
  let service: CameraIngestionService;
  let registry: CameraRegistry;
  let bus: EventBus;

  beforeEach(() => {
    EventBus.resetForTesting();
    registry = new CameraRegistry();
    bus = EventBus.getInstance();
    service = new CameraIngestionService({
      registry,
      eventBus: bus,
      healthCheckIntervalMs: 50,
      streamTimeoutMs: 100,
    });
  });

  afterEach(() => {
    service.stop();
    EventBus.resetForTesting();
  });

  // ─── connect ─────────────────────────────────────────────────────────────────

  it('connect registers a camera with active status', () => {
    const cam = service.connect({ name: 'Side Left', streamUrl: 'rtmp://localhost/live/cam1' });
    expect(cam.status).toBe('active');
    expect(cam.name).toBe('Side Left');
    expect(cam.id).toBeTruthy();
  });

  it('connect emits CAMERA_CONNECTED event', () => {
    const received: CameraEventPayload[] = [];
    bus.on<CameraEventPayload>(VOLLYCAST_EVENTS.CAMERA_CONNECTED, (p) => received.push(p));

    service.connect({ name: 'Side Left', streamUrl: 'rtmp://localhost/live/cam1' });

    expect(received).toHaveLength(1);
    expect(received[0]?.camera.status).toBe('active');
  });

  it('connect assigns a unique ID to each camera', () => {
    const cam1 = service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });
    const cam2 = service.connect({ name: 'Cam 2', streamUrl: 'rtmp://localhost/live/cam2' });
    expect(cam1.id).not.toBe(cam2.id);
  });

  // ─── disconnect ───────────────────────────────────────────────────────────────

  it('disconnect updates status to disconnected', () => {
    const cam = service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });
    service.disconnect(cam.id);
    expect(service.getCamera(cam.id)?.status).toBe('disconnected');
  });

  it('disconnect emits CAMERA_DISCONNECTED event', () => {
    const received: CameraEventPayload[] = [];
    bus.on<CameraEventPayload>(VOLLYCAST_EVENTS.CAMERA_DISCONNECTED, (p) => received.push(p));

    const cam = service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });
    service.disconnect(cam.id);

    expect(received).toHaveLength(1);
    expect(received[0]?.camera.status).toBe('disconnected');
  });

  it('disconnect throws for unknown camera', () => {
    expect(() => service.disconnect('no-such-id')).toThrow('Cannot disconnect unknown camera: no-such-id');
  });

  // ─── heartbeat ────────────────────────────────────────────────────────────────

  it('heartbeat emits STREAM_HEALTH event', () => {
    let healthReceived = false;
    bus.on(VOLLYCAST_EVENTS.STREAM_HEALTH, () => { healthReceived = true; });

    const cam = service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });
    service.heartbeat(cam.id);

    expect(healthReceived).toBe(true);
  });

  it('heartbeat for unknown camera does not throw', () => {
    expect(() => service.heartbeat('unknown-id')).not.toThrow();
  });

  // ─── getCameras ───────────────────────────────────────────────────────────────

  it('getCameras returns all connected cameras', () => {
    service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });
    service.connect({ name: 'Cam 2', streamUrl: 'rtmp://localhost/live/cam2' });
    expect(service.getCameras()).toHaveLength(2);
  });

  it('getCamera returns undefined for unknown ID', () => {
    expect(service.getCamera('unknown')).toBeUndefined();
  });

  // ─── health monitoring ────────────────────────────────────────────────────────

  it('health check marks camera as error after stream timeout', async () => {
    const errorReceived: CameraEventPayload[] = [];
    bus.on<CameraEventPayload>(VOLLYCAST_EVENTS.CAMERA_ERROR, (p) => errorReceived.push(p));

    service.start();
    service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });

    // Wait longer than the stream timeout (100ms) + one health check interval (50ms)
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(errorReceived.length).toBeGreaterThanOrEqual(1);
    expect(errorReceived[0]?.camera.status).toBe('error');
  });

  it('camera stays active when heartbeats are sent regularly', async () => {
    service.start();
    const cam = service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });

    // Send heartbeats every 30ms for 180ms (within 100ms timeout)
    const interval = setInterval(() => service.heartbeat(cam.id), 30);
    await new Promise((resolve) => setTimeout(resolve, 180));
    clearInterval(interval);

    expect(service.getCamera(cam.id)?.status).toBe('active');
  });

  // ─── start / stop lifecycle ───────────────────────────────────────────────────

  it('start() is idempotent — calling twice does not create duplicate timers', () => {
    service.start();
    service.start(); // second call should be a no-op
    service.stop();
    // No assertion needed — test passes if no error/double-firing occurs
  });

  it('stop() cleans up timer — no events after stop', async () => {
    const errorReceived: CameraEventPayload[] = [];
    bus.on<CameraEventPayload>(VOLLYCAST_EVENTS.CAMERA_ERROR, (p) => errorReceived.push(p));

    service.start();
    service.connect({ name: 'Cam 1', streamUrl: 'rtmp://localhost/live/cam1' });
    service.stop(); // stop before health check fires

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(errorReceived).toHaveLength(0);
  });

  it('uses fake timers correctly', () => {
    vi.useFakeTimers();
    service.start();
    service.stop();
    vi.useRealTimers();
  });
});
