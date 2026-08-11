/**
 * CameraGrid — Task 7.1
 * Shows all connected cameras as clickable cards.
 * Clicking a camera auto-registers a scene and switches to it.
 */

import { useCallback } from 'react';
import type { Camera, Scene } from '../api/types.js';
import { registerScene, switchScene } from '../api/client.js';

interface Props {
  cameras: Camera[];
  scenes: Scene[];
  currentSceneId: string | null;
  onSwitch: () => void;
}

export function CameraGrid({ cameras, scenes, currentSceneId, onSwitch }: Props): React.JSX.Element {
  const handleClick = useCallback(async (camera: Camera): Promise<void> => {
    try {
      // Find existing scene for this camera, or register a new one
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

  if (cameras.length === 0) {
    return (
      <div className="rounded-xl bg-brand-panel p-6 text-center text-slate-400">
        No cameras connected. Start streaming from your phone first.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cameras.map((camera) => {
        const scene = scenes.find((s) => s.cameraId === camera.id);
        const isActive = scene !== undefined && scene.id === currentSceneId;
        const isOnline = camera.status === 'active';

        return (
          <button
            key={camera.id}
            onClick={() => { void handleClick(camera); }}
            disabled={!isOnline}
            className={[
              'relative rounded-xl p-3 text-left transition-all duration-150',
              'border-2',
              isActive
                ? 'border-brand-accent bg-brand-accent/10'
                : 'border-brand-card bg-brand-card hover:border-brand-accent/50',
              !isOnline && 'opacity-50 cursor-not-allowed',
            ].join(' ')}
          >
            {/* Thumbnail area */}
            <div className="mb-2 aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
              {isOnline ? (
                <img
                  src={`http://10.248.125.23:8080/hls/${camera.name}.m3u8.png`}
                  alt={camera.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className="flex h-full items-center justify-center">
                <span className="text-2xl">📷</span>
              </div>
            </div>

            {/* Camera name */}
            <div className="font-semibold text-sm truncate">{camera.name}</div>

            {/* Status badge */}
            <div className="mt-1 flex items-center gap-1.5">
              <span className={[
                'h-2 w-2 rounded-full',
                isOnline ? 'bg-brand-ok' : 'bg-slate-500',
              ].join(' ')} />
              <span className="text-xs text-slate-400 capitalize">{camera.status}</span>
              {isActive && (
                <span className="ml-auto rounded bg-brand-accent px-1.5 py-0.5 text-xs font-bold text-brand-dark">
                  LIVE
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
