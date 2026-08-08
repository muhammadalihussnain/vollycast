/**
 * Shared TypeScript interfaces across all VollyCast modules.
 * Types only — no implementation, no side effects.
 */

// ─── Camera ───────────────────────────────────────────────────────────────────

export type CameraId = string;

export type CameraStatus = 'connecting' | 'active' | 'disconnected' | 'error';

export interface Camera {
  readonly id: CameraId;
  readonly name: string;
  readonly streamUrl: string;
  status: CameraStatus;
  readonly connectedAt?: Date;
}

// ─── Stream ───────────────────────────────────────────────────────────────────

export type QualityProfile = 'low' | 'medium' | 'high';

export interface StreamConfig {
  readonly qualityProfile: QualityProfile;
  readonly cameraId: CameraId;
  readonly outputUrl: string;
}

export interface StreamHealth {
  readonly cameraId: CameraId;
  readonly bitrateKbps: number;
  readonly droppedFrames: number;
  readonly latencyMs: number;
  readonly timestamp: Date;
}

// ─── Match & Score ─────────────────────────────────────────────────────────────

export type TeamSide = 'home' | 'away';

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly logoUrl?: string;
}

export interface Score {
  readonly home: number;
  readonly away: number;
}

export interface SetScore {
  readonly setNumber: number;
  readonly score: Score;
  readonly completedAt?: Date;
}

export type MatchStatus = 'pending' | 'live' | 'paused' | 'completed';

export interface Match {
  readonly id: string;
  readonly homeTeam: Team;
  readonly awayTeam: Team;
  currentScore: Score;
  sets: SetScore[];
  currentSet: number;
  status: MatchStatus;
  readonly startedAt?: Date;
  completedAt?: Date;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export type SceneId = string;

export type TransitionType = 'cut' | 'fade';

export interface Scene {
  readonly id: SceneId;
  readonly name: string;
  readonly cameraId: CameraId;
  readonly thumbnailUrl?: string;
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

export type PlatformType = 'youtube' | 'facebook' | 'custom';

export interface BroadcastTarget {
  readonly platform: PlatformType;
  readonly streamKey: string;
  readonly rtmpUrl: string;
}

export type BroadcastStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stopped';

export interface BroadcastState {
  readonly targetPlatform: PlatformType;
  status: BroadcastStatus;
  readonly startedAt?: Date;
  uptimeSeconds: number;
}

// ─── Recording ────────────────────────────────────────────────────────────────

export interface RecordingSegment {
  readonly id: string;
  readonly matchId: string;
  readonly cameraId: CameraId;
  readonly filePath: string;
  readonly startedAt: Date;
  completedAt?: Date;
  fileSizeBytes?: number;
}

// ─── Event Payloads ───────────────────────────────────────────────────────────

export interface CameraEventPayload {
  readonly camera: Camera;
}

export interface ScoreEventPayload {
  readonly matchId: string;
  readonly score: Score;
  readonly setNumber: number;
}

export interface SceneEventPayload {
  readonly previousSceneId: SceneId;
  readonly currentSceneId: SceneId;
  readonly transition: TransitionType;
}

export interface BroadcastEventPayload {
  readonly platform: PlatformType;
  readonly status: BroadcastStatus;
}

export interface StreamHealthPayload {
  readonly health: StreamHealth;
}

export interface DiskSpacePayload {
  readonly usedPercent: number;
  readonly freeGb: number;
}
