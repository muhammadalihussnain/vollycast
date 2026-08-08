/**
 * CameraIngestionService — Tasks 1.1, 1.3, 1.4, 1.5
 *
 * Responsibilities:
 * - Accept camera registrations (RTMP stream URL from DroidCam/IP cameras)
 * - Emit CAMERA_CONNECTED, CAMERA_DISCONNECTED, CAMERA_ERROR events
 * - Monitor stream health via periodic ping
 * - Detect dead streams and update status
 *
 * Design patterns:
 * - Observer: all state changes emitted through EventBus
 * - Factory: createCamera() builds Camera objects consistently
 */

import { randomUUID } from 'node:crypto';
import {
  EventBus,
  VOLLYCAST_EVENTS,
  NETWORK,
  type Camera,
  type CameraId,
  type CameraEventPayload,
  type StreamHealthPayload,
} from '@vollycast/shared';
import { CameraRegistry } from './CameraRegistry.js';
import { logger } from './logger.js';

/** How often to check stream health in milliseconds */
const HEALTH_CHECK_INTERVAL_MS = NETWORK.HEALTH_CHECK_INTERVAL_MS;

/** How long to wait before declaring a stream dead in milliseconds */
const STREAM_TIMEOUT_MS = NETWORK.STREAM_TIMEOUT_MS;

export interface ConnectCameraOptions {
  /** Human-readable label, e.g. "Side Camera Left" */
  name: string;
  /** RTMP stream URL pushed from the phone, e.g. rtmp://192.168.1.x/live/cam1 */
  streamUrl: string;
}

export interface CameraIngestionServiceOptions {
  /** Injected registry — defaults to a new instance */
  registry?: CameraRegistry;
  /** Injected EventBus — defaults to singleton */
  eventBus?: EventBus;
  /** Override health check interval for tests */
  healthCheckIntervalMs?: number;
  /** Override stream timeout for tests */
  streamTimeoutMs?: number;
}

export class CameraIngestionService {
  private readonly registry: CameraRegistry;
  private readonly bus: EventBus;
  private readonly healthCheckIntervalMs: number;
  private readonly streamTimeoutMs: number;

  /** Tracks last-seen timestamp per camera for dead-stream detection */
  private readonly lastSeenAt: Map<CameraId, number> = new Map();

  /** NodeJS timer handle — kept so we can clear it on shutdown */
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  public constructor(options: CameraIngestionServiceOptions = {}) {
    this.registry = options.registry ?? new CameraRegistry();
    this.bus = options.eventBus ?? EventBus.getInstance();
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? HEALTH_CHECK_INTERVAL_MS;
    this.streamTimeoutMs = options.streamTimeoutMs ?? STREAM_TIMEOUT_MS;
  }

  /**
   * Start the health monitoring loop.
   * Call once when the service starts.
   */
  public start(): void {
    if (this.healthTimer !== null) {
      return; // already running
    }
    this.healthTimer = setInterval(() => {
      this.runHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop the health monitoring loop and clean up all timers.
   * Always call this on shutdown to prevent memory/timer leaks.
   */
  public stop(): void {
    if (this.healthTimer !== null) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  /**
   * Connect a camera to the system.
   * Registers it in the registry and emits CAMERA_CONNECTED.
   * @returns the new Camera object
   */
  public connect(options: ConnectCameraOptions): Camera {
    const camera: Camera = {
      id: randomUUID(),
      name: options.name,
      streamUrl: options.streamUrl,
      status: 'connecting',
      connectedAt: new Date(),
    };

    this.registry.register(camera);
    this.lastSeenAt.set(camera.id, Date.now());

    // Simulate stream becoming active after registration
    this.registry.updateStatus(camera.id, 'active');
    const activeCamera = this.registry.get(camera.id) as Camera;

    const payload: CameraEventPayload = { camera: activeCamera };
    this.bus.emit(VOLLYCAST_EVENTS.CAMERA_CONNECTED, payload);

    logger.info({ cameraId: camera.id, name: camera.name }, 'Camera connected');

    return activeCamera;
  }

  /**
   * Disconnect a camera gracefully.
   * Updates status and emits CAMERA_DISCONNECTED.
   */
  public disconnect(id: CameraId): void {
    if (!this.registry.has(id)) {
      throw new Error(`Cannot disconnect unknown camera: ${id}`);
    }

    this.registry.updateStatus(id, 'disconnected');
    this.lastSeenAt.delete(id);

    const camera = this.registry.get(id) as Camera;
    const payload: CameraEventPayload = { camera };
    this.bus.emit(VOLLYCAST_EVENTS.CAMERA_DISCONNECTED, payload);

    logger.info({ cameraId: id }, 'Camera disconnected');
  }

  /**
   * Called by the stream engine to report that a camera's stream is alive.
   * Resets the dead-stream timeout for this camera.
   */
  public heartbeat(id: CameraId): void {
    if (!this.registry.has(id)) {
      return;
    }
    this.lastSeenAt.set(id, Date.now());

    const health: StreamHealthPayload = {
      health: {
        cameraId: id,
        bitrateKbps: 0, // populated by stream engine
        droppedFrames: 0,
        latencyMs: 0,
        timestamp: new Date(),
      },
    };
    this.bus.emit(VOLLYCAST_EVENTS.STREAM_HEALTH, health);
  }

  /**
   * Get all currently registered cameras.
   */
  public getCameras(): Camera[] {
    return this.registry.getAll();
  }

  /**
   * Get a single camera by ID.
   */
  public getCamera(id: CameraId): Camera | undefined {
    return this.registry.get(id);
  }

  /**
   * Run health check — mark cameras as errored if no heartbeat received within timeout.
   * Called automatically by the health timer.
   */
  private runHealthCheck(): void {
    const now = Date.now();
    const activeCameras = this.registry.getByStatus('active');

    for (const camera of activeCameras) {
      const lastSeen = this.lastSeenAt.get(camera.id);
      if (lastSeen === undefined) {
        continue;
      }

      const age = now - lastSeen;
      if (age > this.streamTimeoutMs) {
        this.markAsError(camera.id, 'Stream timeout — no heartbeat received');
      }
    }
  }

  /**
   * Mark a camera as errored and emit CAMERA_ERROR.
   */
  private markAsError(id: CameraId, reason: string): void {
    this.registry.updateStatus(id, 'error');
    const camera = this.registry.get(id) as Camera;

    const payload: CameraEventPayload = { camera };
    this.bus.emit(VOLLYCAST_EVENTS.CAMERA_ERROR, payload);

    logger.warn({ cameraId: id, reason }, 'Camera error detected');
  }
}
