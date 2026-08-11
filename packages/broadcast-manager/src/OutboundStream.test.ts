/**
 * OutboundStream tests
 * Covers branches missed by BroadcastManager tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { ProcessSpawner } from '@vollycast/stream-engine';
import { OutboundStream } from './OutboundStream.js';

function makeFakeProcess(autoExitCode?: number): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  (emitter as unknown as Record<string, unknown>)['killed'] = false;
  (emitter as unknown as Record<string, unknown>)['pid'] = 99999;
  (emitter as unknown as Record<string, unknown>)['stdin'] = null;
  (emitter as unknown as Record<string, unknown>)['stdout'] = null;
  (emitter as unknown as Record<string, unknown>)['stderr'] = null;
  (emitter as unknown as Record<string, unknown>)['stdio'] = [null, null, null];
  (emitter as unknown as Record<string, unknown>)['kill'] = vi.fn((): boolean => {
    setImmediate(() => emitter.emit('exit', 0));
    return true;
  });
  if (autoExitCode !== undefined) {
    setImmediate(() => emitter.emit('exit', autoExitCode));
  }
  return emitter;
}

function makeSpawner(autoExitCode?: number): ProcessSpawner {
  return { spawn: vi.fn(() => makeFakeProcess(autoExitCode)) };
}

describe('OutboundStream', () => {
  it('starts successfully and isRunning() returns true', () => {
    const stream = new OutboundStream({
      id: 'test-stream',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      outputUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
      spawner: makeSpawner(),
    });
    stream.start();
    expect(stream.isRunning()).toBe(true);
    stream.stop();
  });

  it('throws if start() called when already running', () => {
    const stream = new OutboundStream({
      id: 'test-stream',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      outputUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
      spawner: makeSpawner(),
    });
    stream.start();
    expect(() => stream.start()).toThrow('already running');
    stream.stop();
  });

  it('stop() is safe when not running', () => {
    const stream = new OutboundStream({
      id: 'test-stream',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      outputUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
      spawner: makeSpawner(),
    });
    expect(() => stream.stop()).not.toThrow();
  });

  it('isRunning() returns false when not started', () => {
    const stream = new OutboundStream({
      id: 'test-stream',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      outputUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
      spawner: makeSpawner(),
    });
    expect(stream.isRunning()).toBe(false);
  });

  it('calls onExit when process exits cleanly', async () => {
    const onExit = vi.fn();
    const stream = new OutboundStream({
      id: 'exit-stream',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      outputUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
      spawner: makeSpawner(0),
      onExit,
    });
    stream.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(onExit).toHaveBeenCalledWith('exit-stream');
  });

  it('calls onError when process exits with error code', async () => {
    const onError = vi.fn();
    const stream = new OutboundStream({
      id: 'error-stream',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      outputUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
      spawner: makeSpawner(1),
      onError,
    });
    stream.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(onError).toHaveBeenCalledWith('error-stream', 1);
  });

  it('uses FfmpegProcess without spawner when no spawner provided (covers else branch)', async () => {
    // No spawner — covers the `new FfmpegProcess(procOptions)` else branch in start()
    const onError = vi.fn();
    const stream = new OutboundStream({
      id: 'no-spawner',
      inputUrl: 'rtmp://localhost:1935/live/cam1',
      outputUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
      ffmpegBin: 'false', // /usr/bin/false exits with code 1 immediately — safe
      onError,
    });
    stream.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    // process will have exited — either onError fired or stream stopped
    expect(stream.isRunning()).toBe(false);
  });
});
