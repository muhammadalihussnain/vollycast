/**
 * SceneRegistry — Task 5.1
 *
 * Stores all available scenes (one per camera).
 * Design pattern: Repository — business logic never accesses scenes directly.
 *
 * A scene maps a human-readable name to a camera stream.
 * Scenes are registered at startup when cameras connect.
 */

import { randomUUID } from 'node:crypto';
import type { Scene, SceneId, CameraId } from '@vollycast/shared';
import { logger } from './logger.js';

export interface RegisterSceneOptions {
  /** Human-readable name, e.g. "Side Camera Left" */
  readonly name: string;
  /** The camera this scene shows */
  readonly cameraId: CameraId;
  /** Optional thumbnail URL */
  readonly thumbnailUrl?: string;
}

export class SceneRegistry {
  private readonly scenes: Map<SceneId, Scene> = new Map();

  /**
   * Register a new scene.
   * @returns the created Scene
   */
  public register(options: RegisterSceneOptions): Scene {
    const scene: Scene = {
      id: randomUUID(),
      name: options.name,
      cameraId: options.cameraId,
      ...(options.thumbnailUrl !== undefined && { thumbnailUrl: options.thumbnailUrl }),
    };
    this.scenes.set(scene.id, scene);
    logger.info({ sceneId: scene.id, name: scene.name }, 'Scene registered');
    return scene;
  }

  /**
   * Remove a scene by ID.
   * @returns true if removed, false if not found
   */
  public unregister(id: SceneId): boolean {
    const removed = this.scenes.delete(id);
    if (removed) logger.info({ sceneId: id }, 'Scene unregistered');
    return removed;
  }

  /** Get a scene by ID. Returns undefined if not found. */
  public get(id: SceneId): Scene | undefined {
    return this.scenes.get(id);
  }

  /** Get all registered scenes. */
  public getAll(): Scene[] {
    return [...this.scenes.values()];
  }

  /** Whether a scene with this ID exists. */
  public has(id: SceneId): boolean {
    return this.scenes.has(id);
  }

  /** Number of registered scenes. */
  public count(): number {
    return this.scenes.size;
  }

  /** Find scene by camera ID. Returns undefined if none found. */
  public findByCameraId(cameraId: CameraId): Scene | undefined {
    for (const scene of this.scenes.values()) {
      if (scene.cameraId === cameraId) return scene;
    }
    return undefined;
  }
}
