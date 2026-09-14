/**
 * CameraDiscovery — auto-scan network for IP Webcam devices.
 * Shows found cameras and lets user connect them with one click.
 */

import { useState, useCallback } from 'react';
import { scanCameras, connectCamera } from '../api/client.js';

interface Props {
  onConnect: () => void;
}

export function CameraDiscovery({ onConnect }: Props): React.JSX.Element {
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const [subnet, setSubnet] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async (): Promise<void> => {
    setScanning(true);
    setFound([]);
    setError(null);
    try {
      const result = await scanCameras();
      setFound(result.found);
      setSubnet(result.subnet);
      if (result.found.length === 0) {
        setError(`No IP Webcam devices found on ${result.subnet}.x — make sure phones are on the same WiFi and IP Webcam is running`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, []);

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
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">📡 Auto Discover Cameras</h2>
      </div>

      <p className="text-xs text-slate-400">
        Scans your WiFi network for phones running IP Webcam. Make sure IP Webcam is open and the server is started on each phone.
      </p>

      <button
        onClick={() => { void handleScan(); }}
        disabled={scanning}
        className="w-full rounded-lg bg-brand-accent py-2 font-bold text-brand-dark hover:brightness-110 disabled:opacity-50"
      >
        {scanning ? '🔍 Scanning network...' : '🔍 Scan for Cameras'}
      </button>

      {scanning && (
        <div className="text-xs text-slate-400 text-center animate-pulse">
          Scanning {subnet}.1 – {subnet}.254 ... this takes 20-30 seconds
        </div>
      )}

      {error !== null && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {found.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            Found {found.length} device{found.length > 1 ? 's' : ''} on {subnet}.x
          </div>
          {found.map((ip, index) => {
            const camName = `cam${String(index + 1)}`;
            const isConnected = connected.includes(ip);
            return (
              <div key={ip} className="flex items-center justify-between rounded-lg bg-brand-card p-3">
                <div>
                  <div className="text-sm font-semibold">{ip}</div>
                  <div className="text-xs text-slate-400">IP Webcam detected on port 8080</div>
                </div>
                <button
                  onClick={() => { void handleConnect(ip, camName); }}
                  disabled={connecting === ip || isConnected}
                  className={[
                    'rounded-lg px-3 py-1.5 text-sm font-bold transition-colors',
                    isConnected
                      ? 'bg-brand-ok/20 text-brand-ok cursor-default'
                      : 'bg-brand-accent text-brand-dark hover:brightness-110 disabled:opacity-50',
                  ].join(' ')}
                >
                  {isConnected ? '✓ Connected' : connecting === ip ? 'Connecting...' : `Connect as ${camName}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
