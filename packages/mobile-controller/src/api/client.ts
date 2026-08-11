/**
 * Mobile controller API client.
 * All requests go to the scoreboard overlay server on :3001.
 */

export interface Team {
  id: string;
  name: string;
  color: string;
}

export interface Score {
  home: number;
  away: number;
}

export interface SetScore {
  setNumber: number;
  score: Score;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  currentScore: Score;
  sets: SetScore[];
  currentSet: number;
  status: 'pending' | 'live' | 'paused' | 'completed';
}

const BASE = '/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${String(res.status)} ${path}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${String(res.status)} ${path}`);
  return res.json() as Promise<T>;
}

export const getMatch = (matchId: string): Promise<Match> =>
  get<Match>(`/match/${matchId}`);

export const createMatch = (
  homeTeamName: string,
  homeTeamColor: string,
  awayTeamName: string,
  awayTeamColor: string,
): Promise<Match> =>
  post<Match>('/match', {
    homeTeam: { name: homeTeamName, color: homeTeamColor },
    awayTeam: { name: awayTeamName, color: awayTeamColor },
  });

export const incrementScore = (matchId: string, side: 'home' | 'away'): Promise<Match> =>
  post<Match>(`/score/${side}/increment`, { matchId });

export const decrementScore = (matchId: string, side: 'home' | 'away'): Promise<Match> =>
  post<Match>(`/score/${side}/decrement`, { matchId });

export const completeSet = (matchId: string): Promise<Match> =>
  post<Match>('/set/complete', { matchId });
