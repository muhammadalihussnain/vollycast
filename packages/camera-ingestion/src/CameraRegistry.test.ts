import { describe, it, expect, beforeEach } from 'vitest';
import { CameraRegistry } from './CameraRegistry.js';
import type { Camera } from '@vollycast/shared';

const makeCamera = (id: string): Camera => ({
  id,
  name: `Camera ${id}`,
  streamUrl: `rtmp://localhost/live/${id}`,
  status: 'connecting',
});

describe('CameraRegistry', () => {
  let registry: CameraRegistry;

  beforeEach(() => {
    registry = new CameraRegistry();
  });

  it('registers a camera and retrieves it', () => {
    const cam = makeCamera('cam-1');
    registry.register(cam);
    expect(registry.get('cam-1')).toMatchObject({ id: 'cam-1', name: 'Camera cam-1' });
  });

  it('throws when registering duplicate camera ID', () => {
    registry.register(makeCamera('cam-1'));
    expect(() => registry.register(makeCamera('cam-1'))).toThrow('Camera already registered: cam-1');
  });

  it('returns undefined for unknown camera', () => {
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('updates camera status', () => {
    registry.register(makeCamera('cam-1'));
    registry.updateStatus('cam-1', 'active');
    expect(registry.get('cam-1')?.status).toBe('active');
  });

  it('throws when updating status of unknown camera', () => {
    expect(() => registry.updateStatus('unknown', 'active')).toThrow('Camera not found: unknown');
  });

  it('unregisters a camera', () => {
    registry.register(makeCamera('cam-1'));
    registry.unregister('cam-1');
    expect(registry.has('cam-1')).toBe(false);
  });

  it('getAll returns all cameras', () => {
    registry.register(makeCamera('cam-1'));
    registry.register(makeCamera('cam-2'));
    expect(registry.getAll()).toHaveLength(2);
  });

  it('getByStatus filters correctly', () => {
    registry.register(makeCamera('cam-1'));
    registry.register(makeCamera('cam-2'));
    registry.updateStatus('cam-1', 'active');
    registry.updateStatus('cam-2', 'error');

    expect(registry.getByStatus('active')).toHaveLength(1);
    expect(registry.getByStatus('active')[0]?.id).toBe('cam-1');
  });

  it('count returns number of cameras', () => {
    expect(registry.count()).toBe(0);
    registry.register(makeCamera('cam-1'));
    expect(registry.count()).toBe(1);
  });

  it('returns a copy — mutation does not affect registry', () => {
    const cam = makeCamera('cam-1');
    registry.register(cam);
    const retrieved = registry.get('cam-1') as Camera;
    // Mutate the retrieved copy
    (retrieved as { status: string }).status = 'error';
    // Registry should be unaffected
    expect(registry.get('cam-1')?.status).toBe('connecting');
  });

  it('clear removes all cameras', () => {
    registry.register(makeCamera('cam-1'));
    registry.register(makeCamera('cam-2'));
    registry.clear();
    expect(registry.count()).toBe(0);
  });
});
