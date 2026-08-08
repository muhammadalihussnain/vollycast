import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { FfmpegProcess } from './FfmpegProcess.js';
import type { ProcessSpawner } from './FfmpegProcess.js';
import type { ChildProcess } from 'node:child_process';

/** Creates a fake ChildProcess that we can control in tests */
function makeFakeProcess(): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  (emitter as unknown as { pid: number }).pid = 12345;
  emitter.kill = vi.fn().mockReturnValue(true);
  emitter.stdin = null;
  emitter.stdout = null;
  emitter.stderr = null;
  return emitter;
}

function makeFakeSpawner(fakeProc: ChildProcess): ProcessSpawner {
  return {
    spawn: vi.fn().mockReturnValue(fakeProc),
  };
}

describe('FfmpegProcess', () => {
  let fakeProc: ChildProcess;
  let spawner: ProcessSpawner;

  beforeEach(() => {
    fakeProc = makeFakeProcess();
    spawner = makeFakeSpawner(fakeProc);
  });

  // ─── start ────────────────────────────────────────────────────────────────────

  it('starts with idle status', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    expect(proc.status).toBe('idle');
  });

  it('status is running after start()', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    proc.start();
    expect(proc.status).toBe('running');
    expect(proc.isRunning()).toBe(true);
  });

  it('spawner is called with correct binary and args', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: ['-i', 'input'], ffmpegBin: 'ffmpeg' }, spawner);
    proc.start();
    expect(spawner.spawn).toHaveBeenCalledWith('ffmpeg', ['-i', 'input']);
  });

  it('uses "ffmpeg" as default binary', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    proc.start();
    expect(spawner.spawn).toHaveBeenCalledWith('ffmpeg', []);
  });

  it('throws if start() called when already running', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    proc.start();
    expect(() => proc.start()).toThrow('FFmpeg process already running for stream: cam-1');
  });

  // ─── stop ─────────────────────────────────────────────────────────────────────

  it('status is stopped after stop()', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    proc.start();
    proc.stop();
    expect(proc.status).toBe('stopped');
    expect(proc.isRunning()).toBe(false);
  });

  it('sends SIGTERM on stop()', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    proc.start();
    proc.stop();
    expect(fakeProc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('stop() is safe to call when not running', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    expect(() => proc.stop()).not.toThrow();
  });

  it('stop() is safe to call twice', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    proc.start();
    proc.stop();
    expect(() => proc.stop()).not.toThrow();
  });

  // ─── exit callbacks ───────────────────────────────────────────────────────────

  it('calls onExit when process exits with code 0', () => {
    const onExit = vi.fn();
    const proc = new FfmpegProcess({ id: 'cam-1', args: [], onExit }, spawner);
    proc.start();
    fakeProc.emit('exit', 0);
    expect(onExit).toHaveBeenCalledWith('cam-1');
    expect(proc.status).toBe('stopped');
  });

  it('calls onError when process exits with non-zero code', () => {
    const onError = vi.fn();
    const proc = new FfmpegProcess({ id: 'cam-1', args: [], onError }, spawner);
    proc.start();
    fakeProc.emit('exit', 1);
    expect(onError).toHaveBeenCalledWith('cam-1', 1);
    expect(proc.status).toBe('error');
  });

  it('calls onError when process emits error event', () => {
    const onError = vi.fn();
    const proc = new FfmpegProcess({ id: 'cam-1', args: [], onError }, spawner);
    proc.start();
    fakeProc.emit('error', new Error('spawn error'));
    expect(onError).toHaveBeenCalledWith('cam-1', null);
    expect(proc.status).toBe('error');
  });

  it('process reference is cleared after exit — no memory leak', () => {
    const proc = new FfmpegProcess({ id: 'cam-1', args: [] }, spawner);
    proc.start();
    fakeProc.emit('exit', 0);
    // After exit, stop() should be safe (process ref is null)
    expect(() => proc.stop()).not.toThrow();
  });

  it('exposes correct id', () => {
    const proc = new FfmpegProcess({ id: 'stream-42', args: [] }, spawner);
    expect(proc.id).toBe('stream-42');
  });
});
