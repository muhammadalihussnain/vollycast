/**
 * VollyCast Event Bus
 *
 * Design patterns:
 * - Singleton: one shared instance across the entire system
 * - Observer: modules subscribe to events without knowing who emits them
 *
 * Memory leak prevention:
 * - Every on() call returns an unsubscribe function
 * - Always call the returned function when a module shuts down
 */

import { EventEmitter } from 'node:events';
import type { VollyCastEventName } from '../constants/index.js';

/** Generic typed listener signature */
type Listener<T = unknown> = (payload: T) => void;

/** Maximum listeners per event — accommodates all 8 modules */
const MAX_LISTENERS = 50;

class EventBus {
  private static instance: EventBus | null = null;
  private readonly emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(MAX_LISTENERS);
  }

  /**
   * Returns the singleton EventBus instance.
   * Creates it on first call.
   */
  public static getInstance(): EventBus {
    if (EventBus.instance === null) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Emit an event with a typed payload.
   * @param event - one of the VOLLYCAST_EVENTS constants
   * @param payload - data associated with the event
   */
  public emit<T>(event: VollyCastEventName, payload: T): void {
    this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to an event.
   * @returns unsubscribe function — call this on module cleanup to prevent memory leaks
   *
   * @example
   * const unsubscribe = bus.on(VOLLYCAST_EVENTS.CAMERA_CONNECTED, handler);
   * // on shutdown:
   * unsubscribe();
   */
  public on<T>(event: VollyCastEventName, listener: Listener<T>): () => void {
    this.emitter.on(event, listener as Listener);
    return (): void => {
      this.emitter.off(event, listener as Listener);
    };
  }

  /**
   * Subscribe to an event exactly once — auto-unsubscribes after first call.
   */
  public once<T>(event: VollyCastEventName, listener: Listener<T>): void {
    this.emitter.once(event, listener as Listener);
  }

  /**
   * Number of listeners currently registered for an event.
   * Useful for leak detection in tests.
   */
  public listenerCount(event: VollyCastEventName): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Remove all listeners from all events.
   * Only used in tests to reset state between test cases.
   */
  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  /**
   * Destroy the singleton instance.
   * Only used in tests to get a clean instance per test.
   */
  public static resetForTesting(): void {
    if (EventBus.instance !== null) {
      EventBus.instance.removeAllListeners();
      EventBus.instance = null;
    }
  }
}

export { EventBus };
export type { Listener };
