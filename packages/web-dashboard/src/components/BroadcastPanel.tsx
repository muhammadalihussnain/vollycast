/**
 * BroadcastPanel — Task 7.4
 * Start/stop YouTube or Facebook broadcast.
 */

import { useState, useCallback } from 'react';
import type { BroadcastState, PlatformType } from '../api/types.js';
import { startBroadcast, stopBroadcast } from '../api/client.js';

interface Props {
  broadcast: BroadcastState | null;
  onUpdate: () => void;
}

const PLATFORM_LABELS: Record<PlatformType, string> = {
  youtube:  'YouTube',
  facebook: 'Facebook',
  custom:   'Custom RTMP',
};

const DEFAULT_INPUT = 'rtmp://nginx-rtmp:1935/live/cam1';

export function BroadcastPanel({ broadcast, onUpdate }: Props): React.JSX.Element {
  const [platform, setPlatform] = useState<PlatformType>('youtube');
  const [streamKey, setStreamKey] = useState('');
  const [inputUrl, setInputUrl] = useState(DEFAULT_INPUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLive = broadcast?.status === 'live' || broadcast?.status === 'reconnecting';

  const handleStart = useCallback(async (): Promise<void> => {
    if (streamKey.trim().length === 0) { setError('Stream key is required'); return; }
    setLoading(true);
    setError(null);
    try {
      await startBroadcast(platform, streamKey, inputUrl);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start broadcast');
    } finally {
      setLoading(false);
    }
  }, [platform, streamKey, inputUrl, onUpdate]);

  const handleStop = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await stopBroadcast();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop broadcast');
    } finally {
      setLoading(false);
    }
  }, [onUpdate]);

  return (
    <div className="rounded-xl bg-brand-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">Broadcast</h2>
        {broadcast !== null && (
          <span className={[
            'rounded px-2 py-0.5 text-xs font-bold uppercase',
            isLive ? 'bg-brand-live/20 text-brand-live' : 'bg-brand-card text-slate-400',
          ].join(' ')}>
            {broadcast.status}
          </span>
        )}
      </div>

      {!isLive ? (
        <div className="space-y-2">
          {/* Platform */}
          <div className="flex gap-1">
            {(['youtube', 'facebook', 'custom'] as PlatformType[]).map((p) => (
              <button key={p} onClick={() => { setPlatform(p); }}
                className={[
                  'flex-1 rounded py-1 text-xs font-semibold transition-colors',
                  platform === p
                    ? 'bg-brand-accent text-brand-dark'
                    : 'bg-brand-card text-slate-400 hover:text-white',
                ].join(' ')}>
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Stream key */}
          <div>
            <label className="text-xs text-slate-400">Stream Key</label>
            <input
              type="password"
              value={streamKey}
              onChange={(e) => { setStreamKey(e.target.value); }}
              placeholder="Paste your stream key here"
              className="mt-1 w-full rounded bg-brand-card px-3 py-2 text-sm text-white outline-none placeholder-slate-500"
            />
          </div>

          {/* Input URL */}
          <div>
            <label className="text-xs text-slate-400">Input Stream URL</label>
            <input
              value={inputUrl}
              onChange={(e) => { setInputUrl(e.target.value); }}
              className="mt-1 w-full rounded bg-brand-card px-3 py-1.5 text-xs text-white outline-none font-mono"
            />
          </div>

          {error !== null && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={() => { void handleStart(); }}
            disabled={loading}
            className="w-full rounded-lg bg-brand-live py-2 font-bold text-white hover:brightness-110 disabled:opacity-50"
          >
            {loading ? 'Starting...' : `Go Live on ${PLATFORM_LABELS[platform]}`}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-brand-live/10 p-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-brand-live" />
            <span className="font-semibold">
              LIVE on {broadcast?.platform !== null ? PLATFORM_LABELS[broadcast.platform ?? 'custom'] : ''}
            </span>
          </div>
          <button
            onClick={() => { void handleStop(); }}
            disabled={loading}
            className="w-full rounded-lg bg-brand-card py-2 font-bold text-slate-300 hover:bg-red-900 disabled:opacity-50"
          >
            {loading ? 'Stopping...' : 'Stop Broadcast'}
          </button>
        </div>
      )}
    </div>
  );
}
