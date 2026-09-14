/**
 * CameraGrid — 6 fixed camera slots.
 * Each slot shows live video when enabled, gray screen when disabled.
 * Connect/Disconnect button on each slot.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import type { Camera, CameraConfig, Scene } from '../api/types.js';
import { registerScene, switchScene, enableCamera, disableCamera } from '../api/client.js';

interface Props {
  cameras: Camera[];
  cameraConfig: CameraConfig[];
  scenes: Scene[];
  currentSceneId: string | null;
  onSwitch: () => void;
  onConfigChange: () => void;
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
      video.src = hlsUrl;
      void video.play().catch(() => undefined);
    }

    return (): void => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-slate-900"
      style={{ aspectRatio: '16/9' }}>
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
      {active && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-red-600/90 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-bold text-white">LIVE</span>
        </div>
      )}
    </div>
  );
}

/** Gray placeholder for disabled/empty slot */
function EmptySlot({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-slate-800 flex items-center justify-center"
      style={{ aspectRatio: '16/9' }}>
      <div className="text-center">
        <div className="text-3xl mb-1">📷</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

/** Single camera slot */
function CameraSlot({
  config,
  camera,
  scene,
  isActive,
  onSwitch,
  onConfigChange,
}: {
  config: CameraConfig;
  camera: Camera | undefined;
  scene: Scene | undefined;
  isActive: boolean;
  onSwitch: (camera: Camera, scene: Scene | undefined) => Promise<void>;
  onConfigChange: () => void;
}): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [editingIp, setEditingIp] = useState(false);
  const [ipInput, setIpInput] = useState(config.ip);

  const isStreaming = camera !== undefined && (camera.status === 'active' || camera.status === 'error');

  const handleToggle = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (config.enabled) {
        await disableCamera(config.name);
      } else {
        if (config.ip.length === 0) {
          setEditingIp(true);
          setLoading(false);
          return;
        }
        await enableCamera(config.name, config.ip);
      }
      onConfigChange();
    } catch (err) {
      console.error('Toggle failed:', err);
    } finally {
      setLoading(false);
    }
  }, [config, onConfigChange]);

  const handleSaveIp = useCallback(async (): Promise<void> => {
    if (ipInput.trim().length === 0) return;
    setLoading(true);
    setEditingIp(false);
    try {
      await enableCamera(config.name, ipInput.trim());
      onConfigChange();
    } catch (err) {
      console.error('Enable failed:', err);
    } finally {
      setLoading(false);
    }
  }, [config.name, ipInput, onConfigChange]);

  return (
    <div className={[
      'rounded-xl border-2 p-2 transition-all duration-150',
      isActive ? 'border-brand-accent bg-brand-accent/10' : 'border-brand-card bg-brand-card',
    ].join(' ')}>

      {/* Video or placeholder */}
      <button
        onClick={() => { if (camera !== undefined) void onSwitch(camera, scene); }}
        className="w-full"
        disabled={camera === undefined || !config.enabled}
      >
        {isStreaming ? (
          <CameraPreview name={config.name} active={isActive} />
        ) : (
          <EmptySlot label={config.enabled ? 'Connecting...' : 'Disconnected'} />
        )}
      </button>

      {/* IP edit mode */}
      {editingIp && (
        <div className="mt-2 flex gap-1">
          <input
            value={ipInput}
            onChange={(e) => { setIpInput(e.target.value); }}
            placeholder="192.168.x.x"
            className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs text-white outline-none"
          />
          <button onClick={() => { void handleSaveIp(); }}
            className="rounded bg-brand-accent px-2 py-1 text-xs font-bold text-brand-dark">
            Connect
          </button>
          <button onClick={() => { setEditingIp(false); }}
            className="rounded bg-slate-600 px-2 py-1 text-xs text-slate-300">
            Cancel
          </button>
        </div>
      )}

      {/* Camera name + label */}
      <div className="mt-1.5 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-white">{config.name}</div>
          <div className="text-xs text-slate-400">{config.label}</div>
        </div>

        {/* Connect / Disconnect button */}
        <button
          onClick={() => { void handleToggle(); }}
          disabled={loading}
          className={[
            'rounded px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50',
            config.enabled
              ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40'
              : 'bg-brand-ok/20 text-brand-ok hover:bg-brand-ok/40',
          ].join(' ')}
        >
          {loading ? '...' : config.enabled ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Status dot */}
      <div className="mt-1 flex items-center gap-1.5">
        <span className={[
          'h-1.5 w-1.5 rounded-full',
          isStreaming ? 'bg-brand-ok' : config.enabled ? 'bg-brand-warn animate-pulse' : 'bg-slate-600',
        ].join(' ')} />
        <span className="text-xs text-slate-500">
          {isStreaming ? 'Streaming' : config.enabled ? 'Connecting...' : 'Off'}
        </span>
        {isActive && (
          <span className="ml-auto rounded bg-brand-accent px-1 py-0.5 text-xs font-bold text-brand-dark">
            ON AIR
          </span>
        )}
      </div>
    </div>
  );
}

export function CameraGrid({ cameras, cameraConfig, scenes, currentSceneId, onSwitch, onConfigChange }: Props): React.JSX.Element {

  const handleSwitch = useCallback(async (camera: Camera, scene: Scene | undefined): Promise<void> => {
    try {
      let activeScene = scene;
      if (activeScene === undefined) {
        const { registerScene } = await import('../api/client.js');
        activeScene = await registerScene(camera.name, camera.id);
      }
      await switchScene(activeScene.id, 'cut');
      onSwitch();
    } catch (err) {
      console.error('Scene switch failed:', err);
    }
  }, [onSwitch]);

  // Always show exactly 6 slots
  const slots = cameraConfig.length > 0 ? cameraConfig : [
    { name: 'cam1', ip: '', label: 'Camera 1', enabled: false },
    { name: 'cam2', ip: '', label: 'Camera 2', enabled: false },
    { name: 'cam3', ip: '', label: 'Camera 3', enabled: false },
    { name: 'cam4', ip: '', label: 'Camera 4', enabled: false },
    { name: 'cam5', ip: '', label: 'Camera 5', enabled: false },
    { name: 'cam6', ip: '', label: 'Camera 6', enabled: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {slots.map((config) => {
        const camera = cameras.find((c) => c.name === config.name);
        const scene = scenes.find((s) => camera !== undefined && s.cameraId === camera.id);
        const isActive = scene !== undefined && scene.id === currentSceneId;

        return (
          <CameraSlot
            key={config.name}
            config={config}
            camera={camera}
            scene={scene}
            isActive={isActive}
            onSwitch={handleSwitch}
            onConfigChange={onConfigChange}
          />
        );
      })}
    </div>
  );
}
