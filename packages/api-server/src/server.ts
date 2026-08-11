/**
 * VollyCast API Server — combined entry point
 *
 * Wires together:
 *   - Camera Ingestion Service  (Module 1)
 *   - Stream Engine             (Module 2)
 *   - Scoreboard Overlay        (Module 3)
 *   - Broadcast Manager         (Module 4)
 *   - Recording Manager         (Module 6)
 *
 * All modules communicate through the shared EventBus — no direct calls.
 *
 * Environment variables:
 *   API_PORT           — REST + RTMP-callback port  (default 4000)
 *   OVERLAY_PORT       — Scoreboard overlay port     (default 3001)
 *   RTMP_HOST          — nginx-rtmp hostname         (default localhost)
 *   RTMP_PORT          — nginx-rtmp port             (default 1935)
 *   RECORDINGS_PATH    — where to store recordings  (default ./recordings)
 *   STREAM_KEY_SECRET  — 32-byte hex key for AES-256 stream key encryption
 *                        Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createServer as createHttpServer } from 'node:http';
import express, { type Request, type Response } from 'express';

import { EventBus, NETWORK, HTTP_STATUS } from '@vollycast/shared';
import type { PlatformType } from '@vollycast/shared';
import { CameraIngestionService } from '@vollycast/camera-ingestion';
import { StreamEngine }           from '@vollycast/stream-engine';
import { MatchService, OverlaySocket, createApp as createOverlayApp } from '@vollycast/scoreboard-overlay';
import { RecordingManager }       from '@vollycast/recording-manager';
import { BroadcastManager }       from '@vollycast/broadcast-manager';

import { pino } from 'pino';

const logger = pino({ level: 'info' });

// ── Config from environment ──────────────────────────────────────────────────
const API_PORT        = parseInt(process.env['API_PORT']        ?? String(NETWORK.API_PORT),     10);
const OVERLAY_PORT    = parseInt(process.env['OVERLAY_PORT']    ?? String(NETWORK.OVERLAY_PORT), 10);
const RTMP_HOST       = process.env['RTMP_HOST']       ?? 'localhost';
const RTMP_PORT       = parseInt(process.env['RTMP_PORT']       ?? String(NETWORK.RTMP_PORT),    10);
const RECORDINGS_PATH = process.env['RECORDINGS_PATH'] ?? './recordings';
const STREAM_KEY_SECRET = process.env['STREAM_KEY_SECRET'];

// ── Shared event bus ─────────────────────────────────────────────────────────
const bus = EventBus.getInstance();

// ── Module 1: Camera Ingestion ───────────────────────────────────────────────
const cameraService = new CameraIngestionService({ eventBus: bus });

// ── Module 2: Stream Engine ──────────────────────────────────────────────────
const streamEngine = new StreamEngine({
  eventBus:  bus,
  rtmpHost:  RTMP_HOST,
  rtmpPort:  RTMP_PORT,
  defaultProfile: 'medium',
});

// ── Module 3: Scoreboard Overlay ─────────────────────────────────────────────
const matchService   = new MatchService(bus);
const overlayApp     = createOverlayApp(matchService);
const overlayServer  = createHttpServer(overlayApp);
const overlaySocket  = new OverlaySocket(bus);
overlaySocket.attach(overlayServer);

// ── Module 6: Recording Manager ──────────────────────────────────────────────
const recordingManager = new RecordingManager({
  recordingsPath: RECORDINGS_PATH,
  eventBus: bus,
});

// ── Module 4: Broadcast Manager ──────────────────────────────────────────────
const broadcastManager = new BroadcastManager(
  STREAM_KEY_SECRET !== undefined
    ? { eventBus: bus, encryptionKey: STREAM_KEY_SECRET }
    : { eventBus: bus },
);

// ── API server — RTMP callbacks + camera management ─────────────────────────
const apiApp = express();
apiApp.use(express.json());
apiApp.use(express.urlencoded({ extended: true })); // nginx sends form data

// Health check
apiApp.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status:        'ok',
    cameras:       cameraService.getCameras().length,
    activeStreams:  streamEngine.activeStreamCount(),
    broadcast:     broadcastManager.getStatus(),
  });
});

// List connected cameras
apiApp.get('/cameras', (_req: Request, res: Response): void => {
  res.json(cameraService.getCameras());
});

/**
 * Manually register a camera (used when nginx callbacks are not available).
 * Call this after starting a stream from your phone:
 *   curl -X POST http://localhost:4000/cameras/connect \
 *     -H "Content-Type: application/json" \
 *     -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'
 */
apiApp.post('/cameras/connect', (req: Request, res: Response): void => {
  const body = req.body as Record<string, string>;
  const name = body['name'];
  const streamUrl = body['streamUrl'];

  if (name === undefined || streamUrl === undefined) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'name and streamUrl are required' });
    return;
  }

  try {
    const camera = cameraService.connect({ name, streamUrl });
    res.status(HTTP_STATUS.CREATED).json(camera);
  } catch (err) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * Manually disconnect a camera by name.
 */
apiApp.post('/cameras/disconnect', (req: Request, res: Response): void => {
  const body = req.body as Record<string, string>;
  const name = body['name'];
  const camera = cameraService.getCameras().find((c: { name: string }) => c.name === name);

  if (camera === undefined) {
    res.status(HTTP_STATUS.NOT_FOUND).json({ error: `No camera named '${name ?? ''}'` });
    return;
  }

  try {
    cameraService.disconnect(camera.id);
    res.status(HTTP_STATUS.OK).json({ disconnected: camera.id });
  } catch (err) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * nginx RTMP calls this when a phone starts streaming.
 * nginx sends: name=<stream-key> (the part after /live/)
 * We register the camera with the ingestion service.
 */
apiApp.post('/rtmp/on_publish', (req: Request, res: Response): void => {
  const streamKey = (req.body as Record<string, string>)['name'] ?? 'unknown';
  const streamUrl = `rtmp://${RTMP_HOST}:${RTMP_PORT}/live/${streamKey}`;

  logger.info({ streamKey }, 'Phone started streaming');

  try {
    cameraService.connect({ name: streamKey, streamUrl });
    res.status(HTTP_STATUS.OK).send('OK');
  } catch (err) {
    logger.error({ err }, 'Failed to register camera');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Error');
  }
});

/**
 * nginx RTMP calls this when a phone stops streaming.
 */
apiApp.post('/rtmp/on_done', (req: Request, res: Response): void => {
  const streamKey = (req.body as Record<string, string>)['name'] ?? '';
  logger.info({ streamKey }, 'Phone stopped streaming');

  const camera = cameraService.getCameras().find((c: { name: string }) => c.name === streamKey);
  if (camera !== undefined) {
    try {
      cameraService.disconnect(camera.id);
    } catch {
      // already disconnected — ignore
    }
  }
  res.status(HTTP_STATUS.OK).send('OK');
});

/**
 * Get broadcast status.
 * GET /broadcast/status
 */
apiApp.get('/broadcast/status', (_req: Request, res: Response): void => {
  res.json({
    status:   broadcastManager.getStatus(),
    platform: broadcastManager.getPlatform(),
    isLive:   broadcastManager.isLive(),
  });
});

/**
 * Start broadcasting to YouTube or Facebook.
 * POST /broadcast/start
 * Body: { platform, streamKey, inputUrl, customRtmpUrl? }
 *
 * Example (YouTube):
 *   curl -X POST http://localhost:4000/broadcast/start \
 *     -H "Content-Type: application/json" \
 *     -d '{"platform":"youtube","streamKey":"xxxx-xxxx","inputUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'
 *
 * SECURITY: streamKey is encrypted immediately and never logged.
 */
apiApp.post('/broadcast/start', (req: Request, res: Response): void => {
  const body = req.body as Record<string, string>;
  const platform  = body['platform']  as PlatformType | undefined;
  const streamKey = body['streamKey'];
  const inputUrl  = body['inputUrl'];
  const customRtmpUrl = body['customRtmpUrl'];

  if (platform === undefined || streamKey === undefined || inputUrl === undefined) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'platform, streamKey and inputUrl are required',
    });
    return;
  }

  const validPlatforms: PlatformType[] = ['youtube', 'facebook', 'custom'];
  if (!validPlatforms.includes(platform)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: `platform must be one of: ${validPlatforms.join(', ')}`,
    });
    return;
  }

  try {
    broadcastManager.start({ platform, streamKey, inputUrl, customRtmpUrl });
    res.status(HTTP_STATUS.OK).json({
      started:  true,
      platform,
      status:   broadcastManager.getStatus(),
    });
  } catch (err) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * Stop the active broadcast.
 * POST /broadcast/stop
 */
apiApp.post('/broadcast/stop', (_req: Request, res: Response): void => {
  broadcastManager.stop();
  res.status(HTTP_STATUS.OK).json({ stopped: true, status: broadcastManager.getStatus() });
});

// ── Start everything ─────────────────────────────────────────────────────────
async function start(): Promise<void> {
  // Start modules
  cameraService.start();
  streamEngine.start();
  recordingManager.start();

  // Start overlay server
  overlayServer.listen(OVERLAY_PORT, () => {
    logger.info({ port: OVERLAY_PORT }, 'Scoreboard overlay started');
  });

  // Start API server
  apiApp.listen(API_PORT, () => {
    logger.info({ port: API_PORT }, 'VollyCast API server started');
    logger.info({ rtmpHost: RTMP_HOST, rtmpPort: RTMP_PORT }, 'Expecting cameras on RTMP');
    logger.info({ recordingsPath: RECORDINGS_PATH }, 'Recording to');
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(): void {
  logger.info({}, 'Shutting down VollyCast...');
  broadcastManager.stop();
  cameraService.stop();
  streamEngine.stop();
  recordingManager.stop();
  overlaySocket.stop();
  overlayServer.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

void start();
