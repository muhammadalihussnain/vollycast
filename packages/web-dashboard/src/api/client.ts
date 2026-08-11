/**
 * API client — typed fetch wrapper for all VollyCast backend endpoints.
 * All requests go to the same origin (proxied by Vite dev server to :4000).
 */

import type {
  Camera,
  Scene,
  Match,
  BroadcastState,
  HealthState,
  SwitchResult,
  TransitionType,
  PlatformType,
} from './types.js';

const BASE = '';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${String(res.status)} ${path} — ${body}`);
  }
  return res.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

// ── Health ────────────────────────────────────────────────────────────────────

export const getHealth = (): Promise<HealthState> =>
  request<HealthState>('/health');

// ── Cameras ───────────────────────────────────────────────────────────────────

export const getCameras = (): Promise<Camera[]> =>
  request<Camera[]>('/cameras');

export const connectCamera = (name: string, streamUrl: string): Promise<Camera> =>
  post<Camera>('/cameras/connect', { name, streamUrl });

export const disconnectCamera = (name: string): Promise<{ disconnected: string }> =>
  post<{ disconnected: string }>('/cameras/disconnect', { name });

// ── Scenes ────────────────────────────────────────────────────────────────────

export const getScenes = (): Promise<Scene[]> =>
  request<Scene[]>('/scenes');

export const getCurrentScene = (): Promise<Scene> =>
  request<Scene>('/scenes/current');

export const registerScene = (name: string, cameraId: string): Promise<Scene> =>
  post<Scene>('/scenes/register', { name, cameraId });

export const switchScene = (
  sceneId: string,
  transition: TransitionType = 'cut',
): Promise<SwitchResult> =>
  post<SwitchResult>('/scenes/switch', { sceneId, transition });

// ── Score / Match ─────────────────────────────────────────────────────────────

export const createMatch = (
  homeTeamName: string,
  homeTeamColor: string,
  awayTeamName: string,
  awayTeamColor: string,
): Promise<Match> =>
  post<Match>('/api/match', {
    homeTeam: { name: homeTeamName, color: homeTeamColor },
    awayTeam: { name: awayTeamName, color: awayTeamColor },
  });

export const incrementScore = (matchId: string, side: 'home' | 'away'): Promise<Match> =>
  post<Match>(`/api/score/${side}/increment`, { matchId });

export const decrementScore = (matchId: string, side: 'home' | 'away'): Promise<Match> =>
  post<Match>(`/api/score/${side}/decrement`, { matchId });

// ── Broadcast ─────────────────────────────────────────────────────────────────

export const getBroadcastStatus = (): Promise<BroadcastState> =>
  request<BroadcastState>('/broadcast/status');

export const startBroadcast = (
  platform: PlatformType,
  streamKey: string,
  inputUrl: string,
): Promise<{ started: boolean; platform: PlatformType; status: string }> =>
  post('/broadcast/start', { platform, streamKey, inputUrl });

export const stopBroadcast = (): Promise<{ stopped: boolean; status: string }> =>
  post('/broadcast/stop', {});
