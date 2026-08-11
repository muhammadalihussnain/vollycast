/** Shared types for the Web Dashboard API client */

export type CameraStatus = 'connecting' | 'active' | 'disconnected' | 'error';
export type BroadcastStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stopped';
export type PlatformType = 'youtube' | 'facebook' | 'custom';
export type TransitionType = 'cut' | 'fade';
export type MatchStatus = 'pending' | 'live' | 'paused' | 'completed';

export interface Camera {
  id: string;
  name: string;
  streamUrl: string;
  status: CameraStatus;
  connectedAt?: string;
}

export interface Scene {
  id: string;
  name: string;
  cameraId: string;
  thumbnailUrl?: string;
}

export interface Score {
  home: number;
  away: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  logoUrl?: string;
}

export interface SetScore {
  setNumber: number;
  score: Score;
  completedAt?: string;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  currentScore: Score;
  sets: SetScore[];
  currentSet: number;
  status: MatchStatus;
  startedAt?: string;
}

export interface BroadcastState {
  status: BroadcastStatus;
  platform: PlatformType | null;
  isLive: boolean;
}

export interface HealthState {
  status: string;
  cameras: number;
  activeStreams: number;
  broadcast: BroadcastStatus;
}

export interface SwitchResult {
  previousSceneId: string;
  currentSceneId: string;
  transition: TransitionType;
  durationMs: number;
}
