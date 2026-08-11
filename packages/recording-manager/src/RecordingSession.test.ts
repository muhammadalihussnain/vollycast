import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { RecordingSession } from './RecordingSession.js';
import type { SessionSpawner } from './RecordingSession.js';
import type { ChildProcess } from 'node:child_process';

function makeFakeProcess(): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  emitter.kill = vi.fn().mockReturnValue(true);
  emitter.stdin = null;
  emitter.stdout = null;
  emitter.stderr = null;
  return emitter;
}

function makeSpawner(): { spawner: SessionSpawner; proc: () => ChildProcess } {
  let last = makeFakeProcess();
  const spawner: SessionSpawner = {
    spawn: vi.fn().mockImplementation((): ChildProcess => {
      last = makeFakeProcess();
      return last;
    }),
  };
  return { spawner, proc: (): ChildProcess => last };
}

const BASE_OPTIONS = {
  matchId: 'match-1',
  cameraId: 'cam-1',
  setNumber: 1,
  inputUrl: 'rtmp://localhost/live/cam1',
  outputPath: '/recordings/match-1/set1-cam-1.mp4',
};

describe('RecordingSession', () => {
  let spawnerUtil: ReturnType<typeof makeSpawner>;

  beforeEach(() => {
    spawnerUtil = makeSpawner();
  });

  it('has recording status after start()', () => {
    const session = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    session.start();
    expect(session.status).toBe('recording');
    expect(session.isRecording()).toBe(true);
  });

  it('spawner called with correct binary and args', () => {
    const session = new RecordingSession({ ...BASE_OPTIONS, ffmpegBin: 'ffmpeg' }, spawnerUtil.spawner);
    session.start();
    expect(spawnerUtil.spawner.spawn).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-i', BASE_OPTIONS.inputUrl, BASE_OPTIONS.outputPath]),
    );
  });

  it('uses ffmpeg as default binary', () => {
    const session = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    session.start();
    expect(spawnerUtil.spawner.spawn).toHaveBeenCalledWith('ffmpeg', expect.any(Array));
  });

  it('stop() returns completed segment with completedAt', () => {
    const session = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    session.start();
    const segment = session.stop();
    expect(segment.completedAt).toBeDefined();
    expect(segment.cameraId).toBe('cam-1');
    expect(session.status).toBe('stopped');
    expect(session.isRecording()).toBe(false);
  });

  it('stop() sends SIGTERM to process', () => {
    const session = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    session.start();
    const proc = spawnerUtil.proc();
    session.stop();
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('stop() is safe when not recording', () => {
    const session = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    expect(() => session.stop()).not.toThrow();
  });

  it('calls onStop when process exits with code 0', () => {
    const onStop = vi.fn();
    const session = new RecordingSession({ ...BASE_OPTIONS, onStop }, spawnerUtil.spawner);
    session.start();
    spawnerUtil.proc().emit('exit', 0);
    expect(onStop).toHaveBeenCalledWith(session.id);
    expect(session.status).toBe('stopped');
  });

  it('calls onError when process exits with non-zero code', () => {
    const onError = vi.fn();
    const session = new RecordingSession({ ...BASE_OPTIONS, onError }, spawnerUtil.spawner);
    session.start();
    spawnerUtil.proc().emit('exit', 1);
    expect(onError).toHaveBeenCalledWith(session.id);
    expect(session.status).toBe('error');
  });

  it('calls onError when process emits error event', () => {
    const onError = vi.fn();
    const session = new RecordingSession({ ...BASE_OPTIONS, onError }, spawnerUtil.spawner);
    session.start();
    spawnerUtil.proc().emit('error', new Error('spawn failed'));
    expect(onError).toHaveBeenCalled();
    expect(session.status).toBe('error');
  });

  it('segment contains correct matchId, cameraId, setNumber', () => {
    const session = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    expect(session.segment.matchId).toBe('match-1');
    expect(session.segment.cameraId).toBe('cam-1');
    expect(session.segment.filePath).toBe(BASE_OPTIONS.outputPath);
  });

  it('each session has unique id', () => {
    const s1 = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    const s2 = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    expect(s1.id).not.toBe(s2.id);
  });

  it('process reference cleared after stop — no leak', () => {
    const session = new RecordingSession(BASE_OPTIONS, spawnerUtil.spawner);
    session.start();
    session.stop();
    expect(() => session.stop()).not.toThrow();
  });
});
