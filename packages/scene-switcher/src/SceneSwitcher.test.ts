/**
 * SceneSwitcher tests — Tasks 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, VOLLYCAST_EVENTS } from '@vollycast/shared';
import type { SceneEventPayload } from '@vollycast/shared';
import { SceneSwitcher } from './SceneSwitcher.js';
import { SceneRegistry } from './SceneRegistry.js';

describe('SceneSwitcher', () => {
  let bus: EventBus;
  let switcher: SceneSwitcher;

  beforeEach(() => {
    EventBus.resetForTesting();
    bus = EventBus.getInstance();
    switcher = new SceneSwitcher({ eventBus: bus });
  });

  afterEach(() => {
    switcher.stop();
    EventBus.resetForTesting();
  });

  // ── Initial state ────────────────────────────────────────────────────────────

  it('starts with no current scene', () => {
    expect(switcher.getCurrentSceneId()).toBeNull();
    expect(switcher.getCurrentScene()).toBeUndefined();
  });

  it('starts with no registered scenes', () => {
    expect(switcher.getScenes()).toEqual([]);
  });

  it('isSwitching() is false initially', () => {
    expect(switcher.isSwitching()).toBe(false);
  });

  // ── registerScene / unregisterScene ──────────────────────────────────────────

  it('registers a scene', () => {
    const scene = switcher.registerScene({ name: 'Side Left', cameraId: 'cam-1' });
    expect(scene.name).toBe('Side Left');
    expect(switcher.getScenes()).toHaveLength(1);
  });

  it('unregisters a scene', () => {
    const scene = switcher.registerScene({ name: 'Side Left', cameraId: 'cam-1' });
    expect(switcher.unregisterScene(scene.id)).toBe(true);
    expect(switcher.getScenes()).toHaveLength(0);
  });

  it('unregister returns false for unknown id', () => {
    expect(switcher.unregisterScene('ghost-id')).toBe(false);
  });

  it('unregistering current scene resets currentSceneId to null', async () => {
    const scene = switcher.registerScene({ name: 'Main', cameraId: 'cam-1' });
    await switcher.switchTo(scene.id, 'cut');
    expect(switcher.getCurrentSceneId()).toBe(scene.id);

    switcher.unregisterScene(scene.id);
    expect(switcher.getCurrentSceneId()).toBeNull();
  });

  // ── switchTo — cut ───────────────────────────────────────────────────────────

  it('cut switch completes and sets current scene', async () => {
    const scene = switcher.registerScene({ name: 'Main', cameraId: 'cam-1' });
    const result = await switcher.switchTo(scene.id, 'cut');

    expect(result.currentSceneId).toBe(scene.id);
    expect(result.transition).toBe('cut');
    expect(switcher.getCurrentSceneId()).toBe(scene.id);
  });

  it('cut switch completes within 100ms', async () => {
    const scene = switcher.registerScene({ name: 'Main', cameraId: 'cam-1' });
    const start = Date.now();
    await switcher.switchTo(scene.id, 'cut');
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('uses cut as default transition when not specified', async () => {
    const scene = switcher.registerScene({ name: 'Main', cameraId: 'cam-1' });
    const result = await switcher.switchTo(scene.id);
    expect(result.transition).toBe('cut');
  });

  it('cut switch emits SCENE_SWITCHED event', async () => {
    const handler = vi.fn();
    bus.on<SceneEventPayload>(VOLLYCAST_EVENTS.SCENE_SWITCHED, handler);

    const scene = switcher.registerScene({ name: 'Main', cameraId: 'cam-1' });
    await switcher.switchTo(scene.id, 'cut');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ currentSceneId: scene.id, transition: 'cut' }),
    );
  });

  it('cut switch result contains correct previousSceneId', async () => {
    const scene1 = switcher.registerScene({ name: 'Cam 1', cameraId: 'cam-1' });
    const scene2 = switcher.registerScene({ name: 'Cam 2', cameraId: 'cam-2' });

    await switcher.switchTo(scene1.id, 'cut');
    const result = await switcher.switchTo(scene2.id, 'cut');

    expect(result.previousSceneId).toBe(scene1.id);
    expect(result.currentSceneId).toBe(scene2.id);
  });

  // ── switchTo — fade ──────────────────────────────────────────────────────────

  it('fade switch completes and sets current scene', async () => {
    const scene = switcher.registerScene({ name: 'Main', cameraId: 'cam-1' });
    // Use very short fade for test speed
    const fastSwitcher = new SceneSwitcher({ eventBus: bus, fadeDurationMs: 10 });
    fastSwitcher.registerScene({ name: 'Main', cameraId: 'cam-1' });

    const scenes = fastSwitcher.getScenes();
    const result = await fastSwitcher.switchTo(scenes[0]!.id, 'fade');

    expect(result.transition).toBe('fade');
    expect(result.durationMs).toBeGreaterThanOrEqual(10);
    fastSwitcher.stop();
    void scene;
  });

  it('fade switch emits SCENE_SWITCHED event', async () => {
    const handler = vi.fn();
    bus.on<SceneEventPayload>(VOLLYCAST_EVENTS.SCENE_SWITCHED, handler);

    const fastSwitcher = new SceneSwitcher({ eventBus: bus, fadeDurationMs: 10 });
    const scene = fastSwitcher.registerScene({ name: 'Main', cameraId: 'cam-1' });
    await fastSwitcher.switchTo(scene.id, 'fade');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ transition: 'fade' });
    fastSwitcher.stop();
  });

  // ── Error cases ──────────────────────────────────────────────────────────────

  it('throws when switching to unknown scene id', async () => {
    await expect(switcher.switchTo('unknown-scene-id', 'cut')).rejects.toThrow('Scene not found');
  });

  it('throws when switching while a switch is in progress', async () => {
    const fastSwitcher = new SceneSwitcher({ eventBus: bus, fadeDurationMs: 500 });
    const scene1 = fastSwitcher.registerScene({ name: 'Cam 1', cameraId: 'cam-1' });
    const scene2 = fastSwitcher.registerScene({ name: 'Cam 2', cameraId: 'cam-2' });

    // Start a fade switch (doesn't await)
    const fadePromise = fastSwitcher.switchTo(scene1.id, 'fade');

    // Immediately try another switch
    await expect(fastSwitcher.switchTo(scene2.id, 'cut')).rejects.toThrow(
      'already in progress',
    );

    await fadePromise;
    fastSwitcher.stop();
  });

  // ── stop() ───────────────────────────────────────────────────────────────────

  it('stop() clears fade timer and sets switcher to idle', () => {
    const fastSwitcher = new SceneSwitcher({ eventBus: bus, fadeDurationMs: 5000 });
    const scene = fastSwitcher.registerScene({ name: 'Main', cameraId: 'cam-1' });

    // Start a fade (do not await)
    void fastSwitcher.switchTo(scene.id, 'fade');

    // Stop immediately
    fastSwitcher.stop();
    expect(fastSwitcher.isSwitching()).toBe(false);
  });

  it('stop() is safe to call when idle', () => {
    expect(() => switcher.stop()).not.toThrow();
  });

  // ── Injectable registry ──────────────────────────────────────────────────────

  it('accepts an injected SceneRegistry', async () => {
    const registry = new SceneRegistry();
    const scene = registry.register({ name: 'Injected', cameraId: 'cam-x' });
    const s = new SceneSwitcher({ eventBus: bus, registry });

    const result = await s.switchTo(scene.id, 'cut');
    expect(result.currentSceneId).toBe(scene.id);
    s.stop();
  });

  // ── Multiple cameras ─────────────────────────────────────────────────────────

  it('can switch between 6 scenes without errors', async () => {
    const scenes = Array.from({ length: 6 }, (_, i) =>
      switcher.registerScene({ name: `Camera ${String(i + 1)}`, cameraId: `cam-${String(i + 1)}` }),
    );

    for (const scene of scenes) {
      const result = await switcher.switchTo(scene.id, 'cut');
      expect(result.currentSceneId).toBe(scene.id);
    }

    expect(switcher.getCurrentSceneId()).toBe(scenes[5]!.id);
  });
});
