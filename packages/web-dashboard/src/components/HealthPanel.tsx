/**
 * HealthPanel — Task 7.5 / 7.6
 * Shows system health: active cameras, streams, broadcast state, connection.
 */

import type { HealthState } from '../api/types.js';

interface Props {
  health: HealthState | null;
  socketConnected: boolean;
}

function StatBox({ label, value, ok }: { label: string; value: string; ok: boolean }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-brand-card p-3 text-center">
      <div className={`text-2xl font-black ${ok ? 'text-brand-ok' : 'text-brand-warn'}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

export function HealthPanel({ health, socketConnected }: Props): React.JSX.Element {
  if (health === null) {
    return (
      <div className="rounded-xl bg-brand-panel p-4">
        <h2 className="font-bold text-base mb-3">System Health</h2>
        <p className="text-sm text-slate-400">Connecting to API...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-brand-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">System Health</h2>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-brand-ok' : 'bg-brand-warn'}`} />
          <span className="text-xs text-slate-400">{socketConnected ? 'WS connected' : 'WS disconnected'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="API" value={health.status === 'ok' ? 'OK' : 'ERR'} ok={health.status === 'ok'} />
        <StatBox label="Cameras" value={String(health.cameras)} ok={health.cameras > 0} />
        <StatBox label="Streams" value={String(health.activeStreams)} ok={health.activeStreams > 0} />
        <StatBox
          label="Broadcast"
          value={health.broadcast.toUpperCase()}
          ok={health.broadcast === 'live'}
        />
      </div>
    </div>
  );
}
