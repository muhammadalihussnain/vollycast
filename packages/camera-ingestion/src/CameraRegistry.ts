/**
 * CameraRegistry — Task 1.2
 *
 * Tracks all cameras known to the system.
 * Design pattern: Repository — business logic never accesses the store directly.
 *
 * Thread-safety note: Node.js is single-threaded so Map operations are atomic.
 */

import type { Camera, CameraId, CameraStatus } from '@vollycast/shared';

export class CameraRegistry {
  private readonly cameras: Map<CameraId, Camera> = new Map();

  /**
   * Register a new camera. Throws if a camera with the same ID already exists.
   */
  public register(camera: Camera): void {
    if (this.cameras.has(camera.id)) {
      throw new Error(`Camera already registered: ${camera.id}`);
    }
    this.cameras.set(camera.id, { ...camera });
  }

  /**
   * Update the status of an existing camera.
   * Throws if the camera is not registered.
   */
  public updateStatus(id: CameraId, status: CameraStatus): void {
    const camera = this.getOrThrow(id);
    this.cameras.set(id, { ...camera, status });
  }

  /**
   * Remove a camera from the registry.
   */
  public unregister(id: CameraId): void {
    this.cameras.delete(id);
  }

  /**
   * Get a camera by ID. Returns undefined if not found.
   */
  public get(id: CameraId): Camera | undefined {
    const camera = this.cameras.get(id);
    return camera !== undefined ? { ...camera } : undefined;
  }

  /**
   * Get all currently registered cameras.
   */
  public getAll(): Camera[] {
    return Array.from(this.cameras.values()).map((c) => ({ ...c }));
  }

  /**
   * Get all cameras with a specific status.
   */
  public getByStatus(status: CameraStatus): Camera[] {
    return this.getAll().filter((c) => c.status === status);
  }

  /**
   * Returns true if a camera with the given ID is registered.
   */
  public has(id: CameraId): boolean {
    return this.cameras.has(id);
  }

  /**
   * Total number of registered cameras.
   */
  public count(): number {
    return this.cameras.size;
  }

  /**
   * Clear all cameras — used in tests.
   */
  public clear(): void {
    this.cameras.clear();
  }

  private getOrThrow(id: CameraId): Camera {
    const camera = this.cameras.get(id);
    if (camera === undefined) {
      throw new Error(`Camera not found: ${id}`);
    }
    return camera;
  }
}
