/**
 * Express application factory.
 * Kept separate from server startup so it can be imported in tests.
 */

import express, { type Express, type Request, type Response } from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScoreRouter } from './scoreRouter.js';
import type { MatchService } from './MatchService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(matchService: MatchService): Express {
  const app = express();

  app.use(express.json());

  // Serve the scoreboard overlay HTML (OBS browser source)
  app.use(express.static(join(__dirname, '../public')));

  // Health check
  app.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok', service: 'scoreboard-overlay' });
  });

  // Score / match API
  app.use('/api', createScoreRouter(matchService));

  return app;
}
