/**
 * SceneRegistry tests — Task 5.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SceneRegistry } from './SceneRegistry.js';

describe('SceneRegistry', () => {
  let registry: SceneRegistry;

  beforeEach(() => {
    registry = new SceneRegistry();
  });

  describe('register', () => {
    it('registers a scene and returns it with an id', () => {
      const scene = registry.register({ name: 'Side Left', cameraId: 'cam-1' });
      expect(scene.id).toBeTruthy();
      expect(scene.name).toBe('Side Left');
      expect(scene.cameraId).toBe('cam-1');
    });

    it('registers a scene with optional thumbnailUrl', () => {
      const scene = registry.register({
        name: 'Top Camera',
        cameraId: 'cam-2',
        thumbnailUrl: 'http://localhost:8080/thumb.jpg',
      });
      expect(scene.thumbnailUrl).toBe('http://localhost:8080/thumb.jpg');
    });

    it('registered scene does not have thumbnailUrl when not provided', () => {
      const scene = registry.register({ name: 'Side Right', cameraId: 'cam-3' });
      expect(scene.thumbnailUrl).toBeUndefined();
    });

    it('each registered scene gets a unique id', () => {
      const a = registry.register({ name: 'A', cameraId: 'cam-1' });
      const b = registry.register({ name: 'B', cameraId: 'cam-2' });
      expect(a.id).not.toBe(b.id);
    });

    it('increments count after registration', () => {
      expect(registry.count()).toBe(0);
      registry.register({ name: 'A', cameraId: 'cam-1' });
      expect(registry.count()).toBe(1);
      registry.register({ name: 'B', cameraId: 'cam-2' });
      expect(registry.count()).toBe(2);
    });
  });

  describe('get', () => {
    it('returns the scene by id', () => {
      const scene = registry.register({ name: 'Main', cameraId: 'cam-1' });
      expect(registry.get(scene.id)).toEqual(scene);
    });

    it('returns undefined for unknown id', () => {
      expect(registry.get('non-existent-id')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('returns true for registered scene', () => {
      const scene = registry.register({ name: 'Main', cameraId: 'cam-1' });
      expect(registry.has(scene.id)).toBe(true);
    });

    it('returns false for unknown id', () => {
      expect(registry.has('ghost-id')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns empty array when no scenes registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all registered scenes', () => {
      registry.register({ name: 'A', cameraId: 'cam-1' });
      registry.register({ name: 'B', cameraId: 'cam-2' });
      expect(registry.getAll()).toHaveLength(2);
    });

    it('returns a copy — mutating result does not affect registry', () => {
      registry.register({ name: 'A', cameraId: 'cam-1' });
      const all = registry.getAll();
      all.pop();
      expect(registry.count()).toBe(1);
    });
  });

  describe('unregister', () => {
    it('removes a registered scene and returns true', () => {
      const scene = registry.register({ name: 'Main', cameraId: 'cam-1' });
      expect(registry.unregister(scene.id)).toBe(true);
      expect(registry.has(scene.id)).toBe(false);
    });

    it('returns false when scene does not exist', () => {
      expect(registry.unregister('ghost-id')).toBe(false);
    });

    it('decrements count after unregister', () => {
      const scene = registry.register({ name: 'A', cameraId: 'cam-1' });
      registry.unregister(scene.id);
      expect(registry.count()).toBe(0);
    });
  });

  describe('findByCameraId', () => {
    it('finds a scene by camera id', () => {
      const scene = registry.register({ name: 'Side', cameraId: 'cam-xyz' });
      expect(registry.findByCameraId('cam-xyz')).toEqual(scene);
    });

    it('returns undefined when no scene matches camera id', () => {
      expect(registry.findByCameraId('unknown-cam')).toBeUndefined();
    });
  });
});
