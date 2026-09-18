/**
 * CameraDiscovery — uses host agent to scan and connect cameras.
 * The host agent runs on the laptop and handles FFmpeg + network detection.
 */

import { useState, useCallback, useEffect } from 'react';
import { enableCamera } from '../api/client.js';

interface AgentStatus {
  laptopIp: string;
  subnet: string;
  running: Array<{ name: string; pid: number }>;
}

interface Props {
  onConnect: () => void;
}

async function agentFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`/agent${path}`, options);
}

export function CameraDiscovery({ onConnect }: Props): React.JSX.Element {
  const [agentOnline, setAgentOnline] = useState(false);
  const [laptopIp, setLaptopIp] = useState('');
  const [subnet, setSubnet] = useState('');
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Check if host agent is running
  useEffect(() => {
    const check = (): void => {
      agentFetch('/status')
        .then((r) => r.json() as Promise<AgentStatus>)
        .then((data) => {
          setAgentOnline(true);
          setLaptopIp(data.laptopIp);
          setSubnet(data.subnet);
        })
        .catch(() => { setAgentOnline(false); });
    };
    check();
    const timer = setInterval(check, 5000);
    return (): void => { clearInterval(timer); };
  }, []);

  const handleScan = useCallback(async (): Promise<void> => {
    setScanning(true);
    setFound([]);
    setError(null);
    setConnected([]);
    try {
      const res = await agentFetch(`/scan?subnet=${subnet}`);
      const data = await res.json() as { found: string[] };
      setFound(data.found);
      if (data.found.length === 0) {
        setError(`No IP Webcam devices found on ${subnet}.x — make sure phones are on the same WiFi and IP Webcam is running`);
      }
    } catch (err) {
      setError('Scan failed — is host agent running?');
    } finally {
      setScanning(false);
    }
  }, [subnet]);

  const handleConnect = useCallback(async (ip: string, camName: string): Promise<void> => {
    setConnecting(ip);
    try {
      // 1. Start FFmpeg via host agent
      await agentFetch('/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: camName, ip }),
      });

      // 2. Enable camera with API (updates IP in cameraConfig, sets enabled=true, and registers camera)
      await enableCamera(camName, ip);

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
      <button onClick={() => { setCollapsed((c) => !c); }} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-base">📡 Discover Cameras</h2>
          <span className={`h-2 w-2 rounded-full ${agentOnline ? 'bg-brand-ok' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-400">{agentOnline ? `Agent online · ${laptopIp}` : 'Agent offline'}</span>
        </div>
        <span className="text-slate-400 text-sm">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <>
          {!agentOnline && (
            <div className="rounded-lg bg-red-900/20 border border-red-700 p-3 space-y-2">
              <div className="text-sm font-bold text-red-400">⚠ Host Agent not running</div>
              <div className="text-xs text-slate-400">Run this command in a terminal:</div>
              <div className="font-mono text-xs text-green-400 bg-slate-900 p-2 rounded select-all">
                node /home/muhammad/Documents/volly-ball/scripts/host-agent.mjs
              </div>
            </div>
          )}

          {agentOnline && (
            <>
              <div className="text-xs text-slate-400">
                Network: <span className="font-mono text-brand-accent">{subnet}.x</span>
                <span className="ml-2 text-slate-500">(Laptop: {laptopIp})</span>
              </div>

              <p className="text-xs text-slate-400">
                Open IP Webcam on each phone → tap Start server → then scan.
              </p>

              <button
                onClick={() => { void handleScan(); }}
                disabled={scanning}
                className="w-full rounded-lg bg-brand-accent py-2 font-bold text-brand-dark hover:brightness-110 disabled:opacity-50"
              >
                {scanning ? `🔍 Scanning ${subnet}.x ...` : '🔍 Scan for Cameras'}
              </button>

              {scanning && (
                <div className="text-xs text-slate-400 text-center animate-pulse">
                  Scanning 254 addresses... takes ~20 seconds
                </div>
              )}

              {error !== null && <p className="text-xs text-red-400">{error}</p>}

              {found.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-brand-ok font-semibold">
                    ✅ Found {found.length} IP Webcam device{found.length > 1 ? 's' : ''}
                  </div>
                  {found.map((ip, index) => {
                    const camName = `cam${String(index + 1)}`;
                    const isConnected = connected.includes(ip);
                    return (
                      <div key={ip} className="flex items-center justify-between rounded-lg bg-brand-card p-3">
                        <div>
                          <div className="font-mono text-sm font-semibold">{ip}</div>
                          <div className="text-xs text-slate-400">IP Webcam · port 8080</div>
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
                          {isConnected ? '✓ Connected' : connecting === ip ? '...' : `→ ${camName}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
