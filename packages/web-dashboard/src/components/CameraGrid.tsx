/**
 * CameraGrid — Task 7.1
 * Shows all connected cameras as clickable cards with live video preview.
 *
 * Features:
 * - Click card to switch scene
 * - Hover to show controls (remove button, speed control)
 * - Remove camera button (unregisters from API)
 * - Playback speed control (0.25x, 0.5x, 1x)
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import type { Camera, Scene } from '../api/types.js';
import { registerScene, switchScene, disconnectCamera } from '../api/client.js';

interface Props {
  cameras: Camera[];
  scenes: Scene[];
  currentSceneId: string | null;
  onSwitch: () => void;
  hlsBase: string;
}

const SPEED_OPTIONS = [0.25, 0.5, 1.0] as const;
type Speed = typeof SPEED_OPTIONS[number];

/** Live video preview using hls.js with speed control */
function CameraPreview({ name, active }: { name: string; active: boolean }): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hlsUrl = `/hls/${name}.m3u8`;
  const [speed, setSpeed] = useState<Speed>(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 0,
        maxBufferLength: 4,
        maxMaxBufferLength: 8,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
      video.src = hlsUrl;
      void video.play().catch(() => undefined);
    }

    return (): void => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl]);

  // Apply speed change to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video !== null) video.playbackRate = speed;
  }, [speed]);

  return (
    <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-slate-900 group/video">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        muted
        playsInline
      />

      {/* LIVE badge */}
      {active && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-brand-live/90 px-1.5 py-0.5 pointer-events-none">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-bold text-white">LIVE</span>
        </div>
      )}

      {/* Speed control — shown on hover */}
      <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover/video:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSpeedMenu((s) => !s); }}
            className="rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-white hover:bg-black"
          >
            {speed === 1.0 ? '1x' : `${String(speed)}x`} ▾
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-7 right-0 rounded bg-black/90 py-1 shadow-lg z-10">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); setSpeed(s); setShowSpeedMenu(false); }}
                  className={[
                    'block w-full px-4 py-1 text-xs text-left hover:bg-white/10',
                    speed === s ? 'text-brand-accent font-bold' : 'text-white',
                  ].join(' ')}
                >
                  {s === 1.0 ? '1x — Normal' : `${String(s)}x — Slow`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CameraGrid({ cameras, scenes, currentSceneId, onSwitch, hlsBase }: Props): React.JSX.Element {
  const [removing, setRemoving] = useState<string | null>(null);

  const handleClick = useCallback(async (camera: Camera): Promise<void> => {
    try {
      let scene = scenes.find((s) => s.cameraId === camera.id);
      if (scene === undefined) {
        scene = await registerScene(camera.name, camera.id);
      }
      await switchScene(scene.id, 'cut');
      onSwitch();
    } catch (err) {
      console.error('Scene switch failed:', err);
    }
  }, [scenes, onSwitch]);

  const handleRemove = useCallback(async (e: React.MouseEvent, cameraName: string): Promise<void> => {
    e.stopPropagation();
    setRemoving(cameraName);
    try {
      await disconnectCamera(cameraName);
      onSwitch(); // refresh camera list
    } catch (err) {
      console.error('Remove camera failed:', err);
    } finally {
      setRemoving(null);
    }
  }, [onSwitch]);

  // hlsBase used for external VLC link
  void hlsBase;

  if (cameras.length === 0) {
    return (
      <div className="rounded-xl bg-brand-panel p-6 text-center text-slate-400">
        <div className="text-4xl mb-3">📷</div>
        <div className="font-semibold">No cameras connected</div>
        <div className="text-sm mt-1">Start IP Webcam on your phone and run the FFmpeg command</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cameras.map((camera) => {
        const scene = scenes.find((s) => s.cameraId === camera.id);
        const isActive = scene !== undefined && scene.id === currentSceneId;
        const isStreaming = camera.status === 'active' || camera.status === 'error';
        const isRemoving = removing === camera.name;

        return (
          <div
            key={camera.id}
            className={[
              'relative rounded-xl p-3 text-left transition-all duration-150 border-2 group',
              isActive
                ? 'border-brand-accent bg-brand-accent/10'
                : 'border-brand-card bg-brand-card hover:border-brand-accent/50',
            ].join(' ')}
          >
            {/* Remove button — shown on hover */}
            <button
              onClick={(e) => { void handleRemove(e, camera.name); }}
              disabled={isRemoving}
              className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-red-600/80 hover:bg-red-600 px-2 py-0.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {isRemoving ? '...' : '✕ Remove'}
            </button>

            {/* Clickable area for switching scene */}
            <button
              onClick={() => { void handleClick(camera); }}
              className="w-full text-left"
            >
              {/* Live video preview */}
              {isStreaming ? (
                <CameraPreview name={camera.name} active={isActive} />
              ) : (
                <div className="mb-2 aspect-video w-full flex items-center justify-center rounded-lg bg-slate-900">
                  <span className="text-3xl">📷</span>
                </div>
              )}

              {/* Camera name */}
              <div className="font-semibold text-sm truncate">{camera.name}</div>

              {/* Status */}
              <div className="mt-1 flex items-center gap-1.5">
                <span className={[
                  'h-2 w-2 rounded-full',
                  isStreaming ? 'bg-brand-ok' : 'bg-slate-500',
                ].join(' ')} />
                <span className="text-xs text-slate-400 capitalize">
                  {isStreaming ? 'streaming' : camera.status}
                </span>
                {isActive && (
                  <span className="ml-auto rounded bg-brand-accent px-1.5 py-0.5 text-xs font-bold text-brand-dark">
                    ON AIR
                  </span>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
