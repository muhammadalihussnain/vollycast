/**
 * SceneSwitcher — Tasks 5.2, 5.3, 5.4, 5.5
 *
 * Manages live camera scene switching with transition effects.
 *
 * Design patterns:
 * - State Machine: tracks current/previous scene, prevents invalid transitions
 * - Observer: emits SCENE_SWITCHED through EventBus
 * - Strategy: transition type (cut vs fade) selected per switch call
 *
 * Guarantees:
 * - Scene switch completes within SCENE.SWITCH_TIMEOUT_MS (100ms) for cut
 * - Scene switch completes within SCENE.FADE_DURATION_MS (500ms) for fade
 * - No state corruption on rapid switching — busy guard prevents overlap
 * - SCENE_SWITCHED event always emitted after a successful switch
 *
 * Memory leak prevention:
 * - Fade timer cleared on stop() and before each new switch
 */

import {
  EventBus,
  VOLLYCAST_EVENTS,
  SCENE,
  type SceneId,
  type TransitionType,
  type SceneEventPayload,
} from '@vollycast/shared';
import { SceneRegistry } from './SceneRegistry.js';
import type { RegisterSceneOptions } from './SceneRegistry.js';
import type { Scene } from '@vollycast/shared';
import { logger } from './logger.js';

/** Result returned from a successful switch */
export interface SwitchResult {
  readonly previousSceneId: SceneId;
  readonly currentSceneId: SceneId;
  readonly transition: TransitionType;
  readonly durationMs: number;
}

export interface SceneSwitcherOptions {
  /** Injected EventBus — defaults to singleton */
  readonly eventBus?: EventBus;
  /** Injectable registry for testing */
  readonly registry?: SceneRegistry;
  /** Override fade duration for testing */
  readonly fadeDurationMs?: number;
}

/** Switch states for the state machine */
type SwitchState = 'idle' | 'switching';

export class SceneSwitcher {
  private readonly registry: SceneRegistry;
  private readonly bus: EventBus;
  private readonly fadeDurationMs: number;

  private currentSceneId: SceneId | null = null;
  private switchState: SwitchState = 'idle';
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(options: SceneSwitcherOptions = {}) {
    this.registry = options.registry ?? new SceneRegistry();
    this.bus = options.eventBus ?? EventBus.getInstance();
    this.fadeDurationMs = options.fadeDurationMs ?? SCENE.FADE_DURATION_MS;
  }

  /**
   * Register a scene in the registry.
   * Convenience wrapper so callers only need SceneSwitcher.
   */
  public registerScene(options: RegisterSceneOptions): Scene {
    return this.registry.register(options);
  }

  /**
   * Unregister a scene.
   * If the unregistered scene is the current scene, current resets to null.
   */
  public unregisterScene(id: SceneId): boolean {
    if (this.currentSceneId === id) {
      this.currentSceneId = null;
    }
    return this.registry.unregister(id);
  }

  /**
   * Switch to a scene by ID.
   *
   * - cut: instant switch, completes synchronously
   * - fade: resolves after fadeDurationMs
   *
   * @throws if sceneId not found in registry
   * @throws if a switch is already in progress
   */
  public async switchTo(
    sceneId: SceneId,
    transition: TransitionType = 'cut',
  ): Promise<SwitchResult> {
    if (!this.registry.has(sceneId)) {
      throw new Error(`Scene not found: ${sceneId}`);
    }

    if (this.switchState === 'switching') {
      throw new Error('Scene switch already in progress — wait for current switch to complete');
    }

    const previousSceneId = this.currentSceneId ?? sceneId;
    this.switchState = 'switching';

    logger.info(
      { from: previousSceneId, to: sceneId, transition },
      'Scene switch started',
    );

    let durationMs: number;

    if (transition === 'cut') {
      durationMs = await this.executeCut(sceneId);
    } else {
      durationMs = await this.executeFade(sceneId);
    }

    this.currentSceneId = sceneId;
    this.switchState = 'idle';

    const payload: SceneEventPayload = {
      previousSceneId,
      currentSceneId: sceneId,
      transition,
    };

    this.bus.emit(VOLLYCAST_EVENTS.SCENE_SWITCHED, payload);

    logger.info(
      { from: previousSceneId, to: sceneId, transition, durationMs },
      'Scene switch completed',
    );

    return { previousSceneId, currentSceneId: sceneId, transition, durationMs };
  }

  /** Get the currently active scene. Returns undefined if no scene is active. */
  public getCurrentScene(): Scene | undefined {
    if (this.currentSceneId === null) return undefined;
    return this.registry.get(this.currentSceneId);
  }

  /** Get the current scene ID. Returns null if no scene is active. */
  public getCurrentSceneId(): SceneId | null {
    return this.currentSceneId;
  }

  /** Get all registered scenes. */
  public getScenes(): Scene[] {
    return this.registry.getAll();
  }

  /** Whether a switch is currently in progress. */
  public isSwitching(): boolean {
    return this.switchState === 'switching';
  }

  /**
   * Stop and clean up — clear any pending fade timer.
   * Call on shutdown to prevent memory leaks.
   */
  public stop(): void {
    this.clearFadeTimer();
    this.switchState = 'idle';
    logger.info({}, 'Scene switcher stopped');
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Cut transition — instant, no delay.
   * Completes in < SCENE.SWITCH_TIMEOUT_MS (100ms).
   */
  private async executeCut(sceneId: SceneId): Promise<number> {
    const start = Date.now();
    // Cut is synchronous — just update state
    void sceneId; // state updated by caller after this returns
    return Date.now() - start;
  }

  /**
   * Fade transition — waits fadeDurationMs before completing.
   * Completes in ~SCENE.FADE_DURATION_MS (500ms).
   */
  private async executeFade(sceneId: SceneId): Promise<number> {
    const start = Date.now();
    void sceneId;

    this.clearFadeTimer();

    await new Promise<void>((resolve) => {
      this.fadeTimer = setTimeout((): void => {
        this.fadeTimer = null;
        resolve();
      }, this.fadeDurationMs);
    });

    return Date.now() - start;
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}
