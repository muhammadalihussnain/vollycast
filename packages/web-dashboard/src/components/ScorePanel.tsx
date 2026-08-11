/**
 * ScorePanel — Task 7.3
 * Create a match and update score in real time.
 */

import { useState, useCallback } from 'react';
import type { Match } from '../api/types.js';
import { createMatch, incrementScore, decrementScore } from '../api/client.js';

interface Props {
  match: Match | null;
  onMatchUpdate: (match: Match) => void;
}

export function ScorePanel({ match, onMatchUpdate }: Props): React.JSX.Element {
  const [homeTeam, setHomeTeam] = useState('DG Khan A');
  const [awayTeam, setAwayTeam] = useState('DG Khan B');
  const [homeColor, setHomeColor] = useState('#ef4444');
  const [awayColor, setAwayColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const newMatch = await createMatch(homeTeam, homeColor, awayTeam, awayColor);
      onMatchUpdate(newMatch);
    } catch (err) {
      console.error('Create match failed:', err);
    } finally {
      setLoading(false);
    }
  }, [homeTeam, homeColor, awayTeam, awayColor, onMatchUpdate]);

  const handleScore = useCallback(async (side: 'home' | 'away', action: 'increment' | 'decrement'): Promise<void> => {
    if (match === null) return;
    try {
      const updated = action === 'increment'
        ? await incrementScore(match.id, side)
        : await decrementScore(match.id, side);
      onMatchUpdate(updated);
    } catch (err) {
      console.error('Score update failed:', err);
    }
  }, [match, onMatchUpdate]);

  if (match === null) {
    return (
      <div className="rounded-xl bg-brand-panel p-4 space-y-3">
        <h2 className="font-bold text-base">Scoreboard</h2>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400">Home Team</label>
            <div className="flex gap-1 mt-1">
              <input
                value={homeTeam}
                onChange={(e) => { setHomeTeam(e.target.value); }}
                className="flex-1 rounded bg-brand-card px-2 py-1 text-sm text-white outline-none"
              />
              <input type="color" value={homeColor} onChange={(e) => { setHomeColor(e.target.value); }}
                className="w-8 h-8 rounded cursor-pointer bg-brand-card border-0" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Away Team</label>
            <div className="flex gap-1 mt-1">
              <input
                value={awayTeam}
                onChange={(e) => { setAwayTeam(e.target.value); }}
                className="flex-1 rounded bg-brand-card px-2 py-1 text-sm text-white outline-none"
              />
              <input type="color" value={awayColor} onChange={(e) => { setAwayColor(e.target.value); }}
                className="w-8 h-8 rounded cursor-pointer bg-brand-card border-0" />
            </div>
          </div>
        </div>
        <button
          onClick={() => { void handleCreate(); }}
          disabled={loading}
          className="w-full rounded-lg bg-brand-accent py-2 font-bold text-brand-dark hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Start Match'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-brand-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">Scoreboard</h2>
        <span className="rounded bg-brand-ok/20 px-2 py-0.5 text-xs font-bold text-brand-ok uppercase">
          Set {match.currentSet}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Home team */}
        <div className="flex-1 space-y-1 text-center">
          <div className="font-bold text-sm truncate" style={{ color: match.homeTeam.color }}>
            {match.homeTeam.name}
          </div>
          <div className="text-5xl font-black">{match.currentScore.home}</div>
          <div className="flex gap-1 justify-center">
            <button onClick={() => { void handleScore('home', 'decrement'); }}
              className="rounded bg-brand-card px-3 py-1 text-lg font-bold hover:bg-red-900">−</button>
            <button onClick={() => { void handleScore('home', 'increment'); }}
              className="rounded bg-brand-card px-3 py-1 text-lg font-bold hover:bg-green-900">+</button>
          </div>
        </div>

        <div className="text-2xl font-light text-slate-500">:</div>

        {/* Away team */}
        <div className="flex-1 space-y-1 text-center">
          <div className="font-bold text-sm truncate" style={{ color: match.awayTeam.color }}>
            {match.awayTeam.name}
          </div>
          <div className="text-5xl font-black">{match.currentScore.away}</div>
          <div className="flex gap-1 justify-center">
            <button onClick={() => { void handleScore('away', 'decrement'); }}
              className="rounded bg-brand-card px-3 py-1 text-lg font-bold hover:bg-red-900">−</button>
            <button onClick={() => { void handleScore('away', 'increment'); }}
              className="rounded bg-brand-card px-3 py-1 text-lg font-bold hover:bg-green-900">+</button>
          </div>
        </div>
      </div>

      {/* Set history */}
      {match.sets.length > 0 && (
        <div className="border-t border-brand-card pt-2">
          <div className="text-xs text-slate-400 mb-1">Previous sets</div>
          <div className="flex gap-2">
            {match.sets.map((s) => (
              <div key={s.setNumber} className="rounded bg-brand-card px-2 py-1 text-xs">
                Set {s.setNumber}: {s.score.home}–{s.score.away}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
