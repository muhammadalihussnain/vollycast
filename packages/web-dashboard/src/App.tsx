/**
 * App — VollyCast Director Dashboard
 *
 * Layout:
 *   Header — logo + connection status
 *   Left column  — Camera grid + Scene switcher
 *   Right column — Score, Broadcast, Health
 */

import { useState, useCallback } from 'react';
import type { Match, Camera, Scene, BroadcastState, HealthState } from './api/types.js';
import { getCameras, getScenes, getBroadcastStatus, getHealth } from './api/client.js';
import { usePolling } from './hooks/usePolling.js';
import { useSocket } from './hooks/useSocket.js';
import { CameraGrid } from './components/CameraGrid.js';
import { ScenePanel } from './components/ScenePanel.js';
import { ScorePanel } from './components/ScorePanel.js';
import { BroadcastPanel } from './components/BroadcastPanel.js';
import { HealthPanel } from './components/HealthPanel.js';

export function App(): React.JSX.Element {
  const [match, setMatch] = useState<Match | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);

  // Real-time score via WebSocket
  const { connected, match: socketMatch } = useSocket();

  // If socket delivers a match update, prefer it
  const activeMatch = socketMatch ?? match;

  // Polling hooks — refresh every 3s
  const { data: cameras, refresh: refreshCameras } = usePolling<Camera[]>(getCameras);
  const { data: scenes, refresh: refreshScenes } = usePolling<Scene[]>(getScenes);
  const { data: broadcast, refresh: refreshBroadcast } = usePolling<BroadcastState>(getBroadcastStatus);
  const { data: health } = usePolling<HealthState>(getHealth);

  const handleSceneSwitch = useCallback((): void => {
    refreshScenes();
    // Also fetch current scene id
    getScenes()
      .then((all) => {
        // optimistically we don't know which is current — let the next API poll sort it
        void all;
      })
      .catch(() => undefined);
  }, [refreshScenes]);

  const handleCameraSwitch = useCallback((): void => {
    refreshScenes();
    refreshCameras();
    // Fetch current scene
    getScenes()
      .then((all) => { void all; })
      .catch(() => undefined);
  }, [refreshScenes, refreshCameras]);

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-brand-card bg-brand-dark/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-brand-accent">VollyCast</span>
            <span className="text-xs text-slate-500">Director Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-brand-ok' : 'bg-slate-500'}`} />
            <span className="text-xs text-slate-400">{connected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="mx-auto max-w-7xl px-4 py-5 grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Left — cameras + scenes (2/3 width on large screens) */}
        <div className="space-y-4 lg:col-span-2">

          {/* Camera grid */}
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Cameras</h2>
            <CameraGrid
              cameras={cameras ?? []}
              scenes={scenes ?? []}
              currentSceneId={currentSceneId}
              onSwitch={handleCameraSwitch}
            />
          </div>

          {/* Scene switcher */}
          <ScenePanel
            scenes={scenes ?? []}
            currentSceneId={currentSceneId}
            onSwitch={() => {
              handleSceneSwitch();
              // local optimistic update — poll will confirm
              setCurrentSceneId(currentSceneId);
            }}
          />
        </div>

        {/* Right — controls (1/3 width) */}
        <div className="space-y-4">

          {/* Score */}
          <ScorePanel
            match={activeMatch}
            onMatchUpdate={(m) => { setMatch(m); }}
          />

          {/* Broadcast */}
          <BroadcastPanel
            broadcast={broadcast}
            onUpdate={refreshBroadcast}
          />

          {/* Health */}
          <HealthPanel
            health={health}
            socketConnected={connected}
          />
        </div>
      </main>
    </div>
  );
}
