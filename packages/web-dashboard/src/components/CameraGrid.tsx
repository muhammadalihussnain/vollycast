/**
 * CameraGrid — Task 7.1
 * Shows all connected cameras as clickable cards with live video preview.
 * Clicking a camera auto-registers a scene and switches to it.
 */

import { useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import type { Camera, Scene } from '../api/types.js';
import { registerScene, switchScene } from '../api/client.js';

interface Props {
  cameras: Camera[];
  scenes: Scene[];
  currentSceneId: string | null;
  onSwitch: () => void;
  hlsBase: string;
}

/** Live video preview using hls.js */
function CameraPreview({ name, active }: { name: string; active: boolean }): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hlsUrl = `/hls/${name}.m3u8`;

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
      // Safari native HLS
      video.src = hlsUrl;
      void video.play().catch(() => undefined);
    }

    return (): void => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl]);

  return (
    <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        muted
        playsInline
      />
      {active && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-brand-live/90 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-bold text-white">LIVE</span>
        </div>
      )}
    </div>
  );
}

export function CameraGrid({ cameras, scenes, currentSceneId, onSwitch, hlsBase }: Props): React.JSX.Element {
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cameras.map((camera) => {
        const scene = scenes.find((s) => s.cameraId === camera.id);
        const isActive = scene !== undefined && scene.id === currentSceneId;
        const isStreaming = camera.status === 'active' || camera.status === 'error';

        return (
          <button
            key={camera.id}
            onClick={() => { void handleClick(camera); }}
            className={[
              'relative rounded-xl p-3 text-left transition-all duration-150 border-2',
              isActive
                ? 'border-brand-accent bg-brand-accent/10'
                : 'border-brand-card bg-brand-card hover:border-brand-accent/50',
            ].join(' ')}
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
        );
      })}
    </div>
  );
}
