/**
 * Server entry point — wires app + WebSocket + EventBus together.
 * Not covered by unit tests — integration only.
 */

import { createServer } from 'node:http';
import { EventBus, NETWORK } from '@vollycast/shared';
import { MatchService } from './MatchService.js';
import { OverlaySocket } from './OverlaySocket.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

const bus = EventBus.getInstance();
const matchService = new MatchService(bus);
const app = createApp(matchService);
const httpServer = createServer(app);
const overlaySocket = new OverlaySocket(bus);

overlaySocket.attach(httpServer);

const port = process.env['OVERLAY_PORT'] !== undefined
  ? parseInt(process.env['OVERLAY_PORT'], 10)
  : NETWORK.OVERLAY_PORT;

httpServer.listen(port, () => {
  logger.info({ port }, 'Scoreboard overlay server started');
});

// Graceful shutdown
process.on('SIGTERM', (): void => {
  overlaySocket.stop();
  httpServer.close(() => {
    logger.info({}, 'Server closed');
    process.exit(0);
  });
});
