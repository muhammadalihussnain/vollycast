/**
 * App — VollyCast Director Dashboard
 */

import { useState, useCallback } from 'react';
import type { Match, Camera, Scene, BroadcastState, HealthState, CameraConfig } from './api/types.js';
import { getCameras, getScenes, getBroadcastStatus, getHealth, getCameraConfig } from './api/client.js';
import { usePolling } from './hooks/usePolling.js';
import { useSocket } from './hooks/useSocket.js';
import { CameraGrid } from './components/CameraGrid.js';
import { ScenePanel } from './components/ScenePanel.js';
import { ScorePanel } from './components/ScorePanel.js';
import { BroadcastPanel } from './components/BroadcastPanel.js';
import { HealthPanel } from './components/HealthPanel.js';
import { CameraDiscovery } from './components/CameraDiscovery.js';

export function App(): React.JSX.Element {
  const [match, setMatch] = useState<Match | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { connected, match: socketMatch } = useSocket();
  const activeMatch = socketMatch ?? match;

  const { data: cameras, refresh: refreshCameras } = usePolling<Camera[]>(getCameras);
  const { data: scenes, refresh: refreshScenes } = usePolling<Scene[]>(getScenes);
  const { data: broadcast, refresh: refreshBroadcast } = usePolling<BroadcastState>(getBroadcastStatus);
  const { data: health } = usePolling<HealthState>(getHealth);
  const { data: cameraConfig, refresh: refreshConfig } = usePolling<CameraConfig[]>(getCameraConfig);

  const handleConfigChange = useCallback((): void => {
    refreshConfig();
    refreshCameras();
  }, [refreshConfig, refreshCameras]);

  const handleSceneSwitch = useCallback((): void => {
    refreshScenes();
    refreshCameras();
  }, [refreshScenes, refreshCameras]);

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-brand-card bg-brand-dark/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-brand-accent">VollyCast</span>
            <span className="text-xs text-slate-500">Director Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSidebarCollapsed((c) => !c); }}
              className="rounded bg-brand-card px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              {sidebarCollapsed ? '◀ Show Controls' : 'Hide Controls ▶'}
            </button>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-brand-ok' : 'bg-slate-500'}`} />
              <span className="text-xs text-slate-400">{connected ? 'Live' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className={`px-4 py-4 grid gap-4 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'}`}>

        {/* Left — cameras full width when sidebar collapsed */}
        <div className={`space-y-4 ${sidebarCollapsed ? 'w-full' : 'lg:col-span-3'}`}>

          {/* Camera discovery */}
          <CameraDiscovery onConnect={handleConfigChange} />

          {/* Camera grid — 6 fixed slots */}
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              Cameras (6 slots)
            </h2>
            <CameraGrid
              cameras={cameras ?? []}
              cameraConfig={cameraConfig ?? []}
              scenes={scenes ?? []}
              currentSceneId={currentSceneId}
              onSwitch={handleSceneSwitch}
              onConfigChange={handleConfigChange}
            />
          </div>

          {/* Scene switcher */}
          <ScenePanel
            scenes={scenes ?? []}
            currentSceneId={currentSceneId}
            onSwitch={() => {
              handleSceneSwitch();
              setCurrentSceneId(currentSceneId);
            }}
          />
        </div>

        {/* Right sidebar — collapsible */}
        {!sidebarCollapsed && (
          <div className="space-y-4">
            <ScorePanel
              match={activeMatch}
              onMatchUpdate={(m) => { setMatch(m); }}
            />
            <BroadcastPanel
              broadcast={broadcast}
              onUpdate={refreshBroadcast}
            />
            <HealthPanel
              health={health}
              socketConnected={connected}
            />
          </div>
        )}
      </main>
    </div>
  );
}
