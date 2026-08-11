/**
 * ScoreController — Tasks 8.1, 8.2, 8.3
 * Main scorekeeper UI:
 * - Large +/− buttons for home and away
 * - Set management (complete set)
 * - Offline indicator + pending sync count
 */

import { useState, useCallback, useEffect } from 'react';
import type { Match } from '../api/client.js';
import { createMatch } from '../api/client.js';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';
import type { QueuedActionInput } from '../hooks/useOfflineQueue.js';

const DEFAULT_HOME = 'DG Khan A';
const DEFAULT_AWAY = 'DG Khan B';

export function ScoreController(): React.JSX.Element {
  const [match, setMatch] = useState<Match | null>(null);
  const [homeTeam, setHomeTeam] = useState(DEFAULT_HOME);
  const [awayTeam, setAwayTeam] = useState(DEFAULT_AWAY);
  const [creating, setCreating] = useState(false);
  const [showSetConfirm, setShowSetConfirm] = useState(false);

  const { isOnline, pendingCount, enqueue, syncNow } = useOfflineQueue(match?.id ?? null);

  // Periodically sync if there are pending actions
  useEffect(() => {
    if (pendingCount === 0) return;
    const timer = setInterval((): void => { void syncNow(); }, 5000);
    return (): void => { clearInterval(timer); };
  }, [pendingCount, syncNow]);

  const handleCreate = useCallback(async (): Promise<void> => {
    setCreating(true);
    try {
      const m = await createMatch(homeTeam, '#ef4444', awayTeam, '#3b82f6');
      setMatch(m);
    } catch (err) {
      console.error('Create match failed:', err);
    } finally {
      setCreating(false);
    }
  }, [homeTeam, awayTeam]);

  const handleScore = useCallback((side: 'home' | 'away', action: 'increment' | 'decrement'): void => {
    if (match === null) return;

    // Optimistic local update
    setMatch((prev) => {
      if (prev === null) return prev;
      const delta = action === 'increment' ? 1 : -1;
      const newScore = { ...prev.currentScore };
      newScore[side] = Math.max(0, newScore[side] + delta);
      return { ...prev, currentScore: newScore };
    });

    // Queue the actual API call
    enqueue({ type: action, side } as QueuedActionInput);
  }, [match, enqueue]);

  const handleCompleteSet = useCallback((): void => {
    if (match === null) return;
    setShowSetConfirm(false);

    // Optimistic update
    setMatch((prev) => {
      if (prev === null) return prev;
      return {
        ...prev,
        sets: [...prev.sets, { setNumber: prev.currentSet, score: prev.currentScore }],
        currentSet: prev.currentSet + 1,
        currentScore: { home: 0, away: 0 },
      };
    });

    enqueue({ type: 'completeSet' });
  }, [match, enqueue]);

  // ── Setup screen ────────────────────────────────────────────────────────────
  if (match === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-5">
        <div className="text-center">
          <div className="text-2xl font-black text-mc-accent">VollyCast</div>
          <div className="text-sm text-slate-400">New Match</div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <div>
            <label className="text-xs text-slate-400">Home Team</label>
            <input value={homeTeam} onChange={(e) => { setHomeTeam(e.target.value); }}
              className="mt-1 w-full rounded-xl bg-mc-card px-4 py-3 text-base text-white outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Away Team</label>
            <input value={awayTeam} onChange={(e) => { setAwayTeam(e.target.value); }}
              className="mt-1 w-full rounded-xl bg-mc-card px-4 py-3 text-base text-white outline-none" />
          </div>
          <button
            onClick={() => { void handleCreate(); }}
            disabled={creating}
            className="w-full rounded-xl bg-mc-accent py-4 text-base font-bold text-mc-bg disabled:opacity-50"
          >
            {creating ? 'Starting...' : 'Start Match'}
          </button>
        </div>
      </div>
    );
  }

  // ── Score screen ────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">

      {/* Status bar */}
      <div className="flex items-center justify-between bg-mc-card px-4 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-mc-ok' : 'bg-mc-warn animate-pulse'}`} />
          <span className="text-slate-400">{isOnline ? 'Online' : 'Offline'}</span>
          {pendingCount > 0 && (
            <span className="ml-1 rounded bg-mc-warn/20 px-1.5 py-0.5 text-mc-warn font-semibold">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="text-slate-400">
          Set <span className="font-bold text-white">{match.currentSet}</span>
        </div>
      </div>

      {/* Score display */}
      <div className="grid grid-cols-2 border-b border-mc-card">
        <div className="border-r border-mc-card py-6 text-center">
          <div className="text-xs font-bold text-mc-home uppercase tracking-wider truncate px-2">
            {match.homeTeam.name}
          </div>
          <div className="mt-1 text-7xl font-black">{match.currentScore.home}</div>
        </div>
        <div className="py-6 text-center">
          <div className="text-xs font-bold text-mc-away uppercase tracking-wider truncate px-2">
            {match.awayTeam.name}
          </div>
          <div className="mt-1 text-7xl font-black">{match.currentScore.away}</div>
        </div>
      </div>

      {/* Score buttons */}
      <div className="grid grid-cols-2 flex-1">
        {/* Home controls */}
        <div className="flex flex-col border-r border-mc-card">
          <button
            onPointerDown={() => { handleScore('home', 'increment'); }}
            className="flex-1 bg-mc-home/10 active:bg-mc-home/30 flex items-center justify-center text-5xl font-black text-mc-home transition-colors"
            style={{ minHeight: '35vh' }}
          >
            +
          </button>
          <div className="h-px bg-mc-card" />
          <button
            onPointerDown={() => { handleScore('home', 'decrement'); }}
            className="bg-mc-card/50 active:bg-mc-card flex items-center justify-center text-3xl font-bold text-slate-400 py-5 transition-colors"
          >
            −
          </button>
        </div>

        {/* Away controls */}
        <div className="flex flex-col">
          <button
            onPointerDown={() => { handleScore('away', 'increment'); }}
            className="flex-1 bg-mc-away/10 active:bg-mc-away/30 flex items-center justify-center text-5xl font-black text-mc-away transition-colors"
            style={{ minHeight: '35vh' }}
          >
            +
          </button>
          <div className="h-px bg-mc-card" />
          <button
            onPointerDown={() => { handleScore('away', 'decrement'); }}
            className="bg-mc-card/50 active:bg-mc-card flex items-center justify-center text-3xl font-bold text-slate-400 py-5 transition-colors"
          >
            −
          </button>
        </div>
      </div>

      {/* Set history + complete set button */}
      <div className="bg-mc-card px-4 py-3 space-y-2">
        {match.sets.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {match.sets.map((s) => (
              <div key={s.setNumber} className="shrink-0 rounded bg-mc-btn px-2 py-1 text-xs">
                Set {s.setNumber}: {s.score.home}–{s.score.away}
              </div>
            ))}
          </div>
        )}

        {!showSetConfirm ? (
          <button
            onClick={() => { setShowSetConfirm(true); }}
            className="w-full rounded-xl bg-mc-btn py-3 text-sm font-bold text-slate-300 hover:text-white"
          >
            Complete Set {match.currentSet}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setShowSetConfirm(false); }}
              className="flex-1 rounded-xl bg-mc-btn py-3 text-sm font-semibold text-slate-400"
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteSet}
              className="flex-1 rounded-xl bg-mc-accent py-3 text-sm font-bold text-mc-bg"
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
