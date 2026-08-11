/**
 * All numeric and string constants for VollyCast.
 * No magic numbers anywhere in the codebase — import from here.
 */

// ─── Network ──────────────────────────────────────────────────────────────────

export const NETWORK = {
  RTMP_PORT: 1935,
  API_PORT: 4000,
  WS_PORT: 4001,
  OVERLAY_PORT: 3001,
  DASHBOARD_PORT: 3000,
  RTMP_CHUNK_SIZE: 4096,
  RECONNECT_DELAY_MS: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
  STREAM_TIMEOUT_MS: 10_000,
  HEALTH_CHECK_INTERVAL_MS: 5_000,
} as const;

// ─── Stream Quality Profiles ──────────────────────────────────────────────────

export const QUALITY_PROFILES = {
  low: {
    videoBitrateKbps: 800,
    audioBitrateKbps: 64,
    width: 854,
    height: 480,
    frameRate: 25,
    preset: 'ultrafast',
  },
  medium: {
    videoBitrateKbps: 2500,
    audioBitrateKbps: 128,
    width: 1280,
    height: 720,
    frameRate: 30,
    preset: 'veryfast',
  },
  high: {
    videoBitrateKbps: 5000,
    audioBitrateKbps: 192,
    width: 1920,
    height: 1080,
    frameRate: 30,
    preset: 'fast',
  },
} as const;

// ─── HLS ──────────────────────────────────────────────────────────────────────

export const HLS = {
  SEGMENT_DURATION_SECONDS: 2,
  PLAYLIST_SIZE: 5,
  OUTPUT_DIR: './hls',
} as const;

// ─── Score ────────────────────────────────────────────────────────────────────

export const SCORE = {
  MIN_POINTS: 0,
  MAX_POINTS_PER_SET: 25,
  WIN_MARGIN: 2,
  SETS_TO_WIN_MATCH: 3,
  MAX_SETS: 5,
  SCORE_UPDATE_DEBOUNCE_MS: 100,
} as const;

// ─── Scene ────────────────────────────────────────────────────────────────────

export const SCENE = {
  FADE_DURATION_MS: 500,
  THUMBNAIL_INTERVAL_MS: 1000,
  THUMBNAIL_WIDTH: 320,
  THUMBNAIL_HEIGHT: 180,
  SWITCH_TIMEOUT_MS: 100,
} as const;

// ─── Recording ────────────────────────────────────────────────────────────────

export const RECORDING = {
  SEGMENT_DURATION_MINUTES: 30,
  DISK_WARNING_THRESHOLD_PERCENT: 85,
  DISK_CRITICAL_THRESHOLD_PERCENT: 95,
  MIN_FREE_SPACE_GB: 5,
} as const;

// ─── Security ─────────────────────────────────────────────────────────────────

export const SECURITY = {
  JWT_EXPIRY_SECONDS: 3600,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX_REQUESTS: 100,
  BCRYPT_ROUNDS: 12,
  AES_KEY_LENGTH: 256,
} as const;

// ─── Platform RTMP URLs ───────────────────────────────────────────────────────

export const PLATFORM_RTMP_URLS = {
  youtube: 'rtmp://a.rtmp.youtube.com/live2',
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
} as const;

// ─── WebSocket Rooms ──────────────────────────────────────────────────────────

export const WS_ROOMS = {
  OVERLAY: 'overlay',
  DASHBOARD: 'dashboard',
  MOBILE_CONTROLLER: 'mobile-controller',
} as const;

// ─── Event Names ──────────────────────────────────────────────────────────────

export const VOLLYCAST_EVENTS = {
  CAMERA_CONNECTED: 'camera:connected',
  CAMERA_DISCONNECTED: 'camera:disconnected',
  CAMERA_ERROR: 'camera:error',
  SCORE_UPDATED: 'score:updated',
  SET_COMPLETED: 'set:completed',
  MATCH_STARTED: 'match:started',
  MATCH_COMPLETED: 'match:completed',
  SCENE_SWITCHED: 'scene:switched',
  BROADCAST_STARTED: 'broadcast:started',
  BROADCAST_STOPPED: 'broadcast:stopped',
  BROADCAST_RECONNECTING: 'broadcast:reconnecting',
  STREAM_HEALTH: 'stream:health',
  RECORDING_STARTED: 'recording:started',
  RECORDING_STOPPED: 'recording:stopped',
  DISK_SPACE_WARNING: 'disk:space:warning',
} as const;

export type VollyCastEventName = (typeof VOLLYCAST_EVENTS)[keyof typeof VOLLYCAST_EVENTS];

// ─── HTTP Status Codes ────────────────────────────────────────────────────────

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ─── Validation Limits ────────────────────────────────────────────────────────

export const VALIDATION = {
  TEAM_NAME_MAX_LENGTH: 50,
  TEAM_NAME_MIN_LENGTH: 1,
} as const;
