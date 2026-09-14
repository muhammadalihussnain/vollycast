/**
 * CameraDiscovery — auto-scan network for IP Webcam devices.
 * Auto-detects the subnet or lets user enter it manually.
 */

import { useState, useCallback, useEffect } from 'react';
import { scanCameras, connectCamera } from '../api/client.js';

interface Props {
  onConnect: () => void;
}

const SUBNET_URL = '/cameras/subnet';

export function CameraDiscovery({ onConnect }: Props): React.JSX.Element {
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const [subnet, setSubnet] = useState('');
  const [subnetInput, setSubnetInput] = useState('');
  const [editingSubnet, setEditingSubnet] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  // Auto-detect subnet on mount
  useEffect(() => {
    fetch(SUBNET_URL)
      .then((r) => r.json() as Promise<{ subnet: string }>)
      .then((data) => {
        setSubnet(data.subnet);
        setSubnetInput(data.subnet);
      })
      .catch(() => undefined);
  }, []);

  const handleScan = useCallback(async (): Promise<void> => {
    setScanning(true);
    setFound([]);
    setError(null);
    setConnected([]);
    try {
      const result = await scanCameras(subnet);
      setFound(result.found);
      if (result.found.length === 0) {
        setError(`No IP Webcam devices found on ${subnet}.x — make sure phones are on the same WiFi and IP Webcam app is running with server started`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [subnet]);

  const handleConnect = useCallback(async (ip: string, camName: string): Promise<void> => {
    setConnecting(ip);
    try {
      await connectCamera(camName, `rtmp://nginx-rtmp:1935/live/${camName}`);
      setConnected((prev) => [...prev, ip]);
      onConnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setConnecting(null);
    }
  }, [onConnect]);

  return (
    <div className="rounded-xl bg-brand-panel p-4 space-y-3">
      {/* Header */}
      <button onClick={() => { setCollapsed((c) => !c); }} className="flex w-full items-center justify-between">
        <h2 className="font-bold text-base">📡 Discover Cameras</h2>
        <span className="text-slate-400 text-sm">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <>
          {/* Subnet display + edit */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Network:</span>
            {editingSubnet ? (
              <div className="flex gap-1 flex-1">
                <input
                  value={subnetInput}
                  onChange={(e) => { setSubnetInput(e.target.value); }}
                  placeholder="192.168.1"
                  className="flex-1 rounded bg-brand-card px-2 py-1 text-xs text-white outline-none font-mono"
                />
                <button
                  onClick={() => { setSubnet(subnetInput); setEditingSubnet(false); }}
                  className="rounded bg-brand-accent px-2 py-1 text-xs font-bold text-brand-dark"
                >
                  Use
                </button>
                <button
                  onClick={() => { setEditingSubnet(false); }}
                  className="rounded bg-slate-600 px-2 py-1 text-xs text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <span className="font-mono text-xs text-brand-accent">
                  {subnet !== '' ? `${subnet}.x` : 'Detecting...'}
                </span>
                <button
                  onClick={() => { setEditingSubnet(true); }}
                  className="text-xs text-slate-500 hover:text-slate-300 underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Opens IP Webcam on each phone → tap Start server → then scan here.
          </p>

          <button
            onClick={() => { void handleScan(); }}
            disabled={scanning || subnet === ''}
            className="w-full rounded-lg bg-brand-accent py-2 font-bold text-brand-dark hover:brightness-110 disabled:opacity-50"
          >
            {scanning ? `🔍 Scanning ${subnet}.x ...` : '🔍 Scan for Cameras'}
          </button>

          {scanning && (
            <div className="text-xs text-slate-400 text-center animate-pulse">
              This takes 20-30 seconds...
            </div>
          )}

          {error !== null && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {found.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">
                ✅ Found {found.length} device{found.length > 1 ? 's' : ''}
              </div>
              {found.map((ip, index) => {
                const camName = `cam${String(index + 1)}`;
                const isConnected = connected.includes(ip);
                return (
                  <div key={ip} className="flex items-center justify-between rounded-lg bg-brand-card p-3">
                    <div>
                      <div className="text-sm font-semibold font-mono">{ip}</div>
                      <div className="text-xs text-slate-400">IP Webcam on port 8080</div>
                    </div>
                    <button
                      onClick={() => { void handleConnect(ip, camName); }}
                      disabled={connecting === ip || isConnected}
                      className={[
                        'rounded-lg px-3 py-1.5 text-sm font-bold',
                        isConnected
                          ? 'bg-brand-ok/20 text-brand-ok cursor-default'
                          : 'bg-brand-accent text-brand-dark hover:brightness-110 disabled:opacity-50',
                      ].join(' ')}
                    >
                      {isConnected ? '✓ Connected' : connecting === ip ? '...' : `→ ${camName}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
