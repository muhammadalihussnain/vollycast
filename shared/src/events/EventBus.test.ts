import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './EventBus.js';
import { VOLLYCAST_EVENTS } from '../constants/index.js';
import type { CameraEventPayload } from '../types/index.js';

describe('EventBus', () => {
  beforeEach(() => {
    EventBus.resetForTesting();
  });

  it('returns the same singleton instance on every call', () => {
    const a = EventBus.getInstance();
    const b = EventBus.getInstance();
    expect(a).toBe(b);
  });

  it('delivers emitted payload to subscriber', () => {
    const bus = EventBus.getInstance();
    const received: CameraEventPayload[] = [];

    bus.on<CameraEventPayload>(VOLLYCAST_EVENTS.CAMERA_CONNECTED, (payload) => {
      received.push(payload);
    });

    const payload: CameraEventPayload = {
      camera: {
        id: 'cam-1',
        name: 'Camera 1',
        streamUrl: 'rtmp://localhost/live/cam1',
        status: 'active',
      },
    };

    bus.emit(VOLLYCAST_EVENTS.CAMERA_CONNECTED, payload);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(payload);
  });

  it('delivers events to multiple subscribers', () => {
    const bus = EventBus.getInstance();
    let countA = 0;
    let countB = 0;

    bus.on(VOLLYCAST_EVENTS.SCORE_UPDATED, () => { countA++; });
    bus.on(VOLLYCAST_EVENTS.SCORE_UPDATED, () => { countB++; });

    bus.emit(VOLLYCAST_EVENTS.SCORE_UPDATED, { matchId: 'm1', score: { home: 1, away: 0 }, setNumber: 1 });

    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it('unsubscribe function stops receiving events', () => {
    const bus = EventBus.getInstance();
    let count = 0;

    const unsubscribe = bus.on(VOLLYCAST_EVENTS.CAMERA_DISCONNECTED, () => { count++; });

    bus.emit(VOLLYCAST_EVENTS.CAMERA_DISCONNECTED, { camera: { id: 'cam-1', name: 'Camera 1', streamUrl: '', status: 'disconnected' } });
    expect(count).toBe(1);

    unsubscribe();

    bus.emit(VOLLYCAST_EVENTS.CAMERA_DISCONNECTED, { camera: { id: 'cam-1', name: 'Camera 1', streamUrl: '', status: 'disconnected' } });
    expect(count).toBe(1); // still 1 — listener was removed
  });

  it('once() fires exactly one time', () => {
    const bus = EventBus.getInstance();
    let count = 0;

    bus.once(VOLLYCAST_EVENTS.MATCH_STARTED, () => { count++; });

    bus.emit(VOLLYCAST_EVENTS.MATCH_STARTED, {});
    bus.emit(VOLLYCAST_EVENTS.MATCH_STARTED, {});

    expect(count).toBe(1);
  });

  it('listenerCount returns correct number', () => {
    const bus = EventBus.getInstance();

    bus.on(VOLLYCAST_EVENTS.SCENE_SWITCHED, () => { /* listener */ });
    bus.on(VOLLYCAST_EVENTS.SCENE_SWITCHED, () => { /* listener */ });

    expect(bus.listenerCount(VOLLYCAST_EVENTS.SCENE_SWITCHED)).toBe(2);
  });

  it('removeAllListeners clears all subscriptions', () => {
    const bus = EventBus.getInstance();
    let count = 0;

    bus.on(VOLLYCAST_EVENTS.BROADCAST_STARTED, () => { count++; });
    bus.removeAllListeners();
    bus.emit(VOLLYCAST_EVENTS.BROADCAST_STARTED, {});

    expect(count).toBe(0);
  });

  it('resetForTesting creates a fresh instance', () => {
    const a = EventBus.getInstance();
    EventBus.resetForTesting();
    const b = EventBus.getInstance();
    expect(a).not.toBe(b);
  });

  it('unsubscribing does not affect other subscribers on same event', () => {
    const bus = EventBus.getInstance();
    let countA = 0;
    let countB = 0;

    const unsubscribeA = bus.on(VOLLYCAST_EVENTS.RECORDING_STARTED, () => { countA++; });
    bus.on(VOLLYCAST_EVENTS.RECORDING_STARTED, () => { countB++; });

    unsubscribeA();

    bus.emit(VOLLYCAST_EVENTS.RECORDING_STARTED, {});

    expect(countA).toBe(0);
    expect(countB).toBe(1);
  });
});
