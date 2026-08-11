/**
 * ScenePanel — Task 7.2
 * Shows registered scenes and allows cut/fade switching.
 */

import { useState, useCallback } from 'react';
import type { Scene } from '../api/types.js';
import type { TransitionType } from '../api/types.js';
import { switchScene } from '../api/client.js';

interface Props {
  scenes: Scene[];
  currentSceneId: string | null;
  onSwitch: () => void;
}

export function ScenePanel({ scenes, currentSceneId, onSwitch }: Props): React.JSX.Element {
  const [transition, setTransition] = useState<TransitionType>('cut');
  const [switching, setSwitching] = useState(false);

  const handleSwitch = useCallback(async (sceneId: string): Promise<void> => {
    if (switching) return;
    setSwitching(true);
    try {
      await switchScene(sceneId, transition);
      onSwitch();
    } catch (err) {
      console.error('Switch failed:', err);
    } finally {
      setSwitching(false);
    }
  }, [switching, transition, onSwitch]);

  return (
    <div className="rounded-xl bg-brand-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">Scene Switcher</h2>
        {/* Transition toggle */}
        <div className="flex rounded-lg overflow-hidden border border-brand-card">
          {(['cut', 'fade'] as TransitionType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTransition(t); }}
              className={[
                'px-3 py-1 text-xs font-semibold uppercase transition-colors',
                transition === t
                  ? 'bg-brand-accent text-brand-dark'
                  : 'bg-brand-card text-slate-400 hover:text-white',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {scenes.length === 0 ? (
        <p className="text-sm text-slate-400">No scenes registered. Click a camera above to create one.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {scenes.map((scene) => {
            const isActive = scene.id === currentSceneId;
            return (
              <button
                key={scene.id}
                onClick={() => { void handleSwitch(scene.id); }}
                disabled={switching || isActive}
                className={[
                  'rounded-lg px-3 py-2 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-brand-accent text-brand-dark cursor-default'
                    : 'bg-brand-card hover:bg-brand-accent/20 border border-brand-card hover:border-brand-accent/50',
                  switching && !isActive && 'opacity-50 cursor-wait',
                ].join(' ')}
              >
                {isActive && <span className="mr-1">▶</span>}
                {scene.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
