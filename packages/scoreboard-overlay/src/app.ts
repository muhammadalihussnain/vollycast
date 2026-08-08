/**
 * Express application factory.
 * Kept separate from server startup so it can be imported in tests.
 */

import express, { type Express, type Request, type Response } from 'express';
import { createScoreRouter } from './scoreRouter.js';
import type { MatchService } from './MatchService.js';

export function createApp(matchService: MatchService): Express {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok', service: 'scoreboard-overlay' });
  });

  // Score / match API
  app.use('/api', createScoreRouter(matchService));

  return app;
}
