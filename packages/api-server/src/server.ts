/**
 * VollyCast API Server — combined entry point
 *
 * Wires together:
 *   - Camera Ingestion Service  (Module 1)
 *   - Stream Engine             (Module 2)
 *   - Scoreboard Overlay        (Module 3)
 *   - Broadcast Manager         (Module 4)
 *   - Scene Switcher            (Module 5)
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
import type { PlatformType, TransitionType } from '@vollycast/shared';
import { CameraIngestionService } from '@vollycast/camera-ingestion';
import { StreamEngine }           from '@vollycast/stream-engine';
import { MatchService, OverlaySocket, createApp as createOverlayApp } from '@vollycast/scoreboard-overlay';
import { RecordingManager }       from '@vollycast/recording-manager';
import { BroadcastManager }       from '@vollycast/broadcast-manager';
import { SceneSwitcher }          from '@vollycast/scene-switcher';

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

// ── Module 5: Scene Switcher ──────────────────────────────────────────────────
const sceneSwitcher = new SceneSwitcher({ eventBus: bus });

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

// ── Scene endpoints ──────────────────────────────────────────────────────────

/**
 * List all registered scenes.
 * GET /scenes
 */
apiApp.get('/scenes', (_req: Request, res: Response): void => {
  res.json(sceneSwitcher.getScenes());
});

/**
 * Get the currently active scene.
 * GET /scenes/current
 */
apiApp.get('/scenes/current', (_req: Request, res: Response): void => {
  const scene = sceneSwitcher.getCurrentScene();
  if (scene === undefined) {
    res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'No active scene' });
    return;
  }
  res.json(scene);
});

/**
 * Register a scene for a camera.
 * POST /scenes/register
 * Body: { name, cameraId, thumbnailUrl? }
 *
 * Example:
 *   curl -X POST http://localhost:4000/scenes/register \
 *     -H "Content-Type: application/json" \
 *     -d '{"name":"Side Left","cameraId":"<camera-id>"}'
 */
apiApp.post('/scenes/register', (req: Request, res: Response): void => {
  const body = req.body as Record<string, string>;
  const name = body['name'];
  const cameraId = body['cameraId'];
  const thumbnailUrl = body['thumbnailUrl'];

  if (name === undefined || cameraId === undefined) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'name and cameraId are required' });
    return;
  }

  const options = thumbnailUrl !== undefined
    ? { name, cameraId, thumbnailUrl }
    : { name, cameraId };

  const scene = sceneSwitcher.registerScene(options);
  res.status(HTTP_STATUS.CREATED).json(scene);
});

/**
 * Switch to a scene by ID.
 * POST /scenes/switch
 * Body: { sceneId, transition? }
 * transition: 'cut' (default, instant) | 'fade' (smooth, ~500ms)
 *
 * Example (cut):
 *   curl -X POST http://localhost:4000/scenes/switch \
 *     -H "Content-Type: application/json" \
 *     -d '{"sceneId":"<scene-id>"}'
 *
 * Example (fade):
 *   curl -X POST http://localhost:4000/scenes/switch \
 *     -H "Content-Type: application/json" \
 *     -d '{"sceneId":"<scene-id>","transition":"fade"}'
 */
apiApp.post('/scenes/switch', (req: Request, res: Response): void => {
  const body = req.body as Record<string, string>;
  const sceneId = body['sceneId'];
  const transition = (body['transition'] ?? 'cut') as TransitionType;

  if (sceneId === undefined) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'sceneId is required' });
    return;
  }

  const validTransitions: TransitionType[] = ['cut', 'fade'];
  if (!validTransitions.includes(transition)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: `transition must be one of: ${validTransitions.join(', ')}`,
    });
    return;
  }

  void sceneSwitcher.switchTo(sceneId, transition).then((result) => {
    res.status(HTTP_STATUS.OK).json(result);
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: message });
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ error: message });
    }
  });
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
  sceneSwitcher.stop();
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
