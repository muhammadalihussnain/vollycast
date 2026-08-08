/**
 * scoreRouter — Task 3.3
 * REST API endpoints for match and score management.
 * All inputs validated with Zod before processing.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { MatchService } from './MatchService.js';

const TeamSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.string().url().optional(),
});

const CreateMatchSchema = z.object({
  homeTeam: TeamSchema,
  awayTeam: TeamSchema,
});

const SideSchema = z.enum(['home', 'away']);

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

export function createScoreRouter(matchService: MatchService): Router {
  const router = Router();

  /** POST /api/match — create a new match */
  router.post('/match', (req: Request, res: Response): void => {
    const parsed = CreateMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.message);
      return;
    }
    try {
      const match = matchService.createMatch(parsed.data);
      res.status(201).json(match);
    } catch (err) {
      sendError(res, 500, toMessage(err));
    }
  });

  /** POST /api/match/start — start the active match */
  router.post('/match/start', (_req: Request, res: Response): void => {
    try {
      const match = matchService.startMatch();
      res.json(match);
    } catch (err) {
      sendError(res, 400, toMessage(err));
    }
  });

  /** GET /api/match — get current match state */
  router.get('/match', (_req: Request, res: Response): void => {
    const match = matchService.getMatch();
    if (match === null) {
      sendError(res, 404, 'No active match');
      return;
    }
    res.json(match);
  });

  /** GET /api/score — get current score */
  router.get('/score', (_req: Request, res: Response): void => {
    try {
      const score = matchService.getScore();
      res.json(score);
    } catch (err) {
      sendError(res, 404, toMessage(err));
    }
  });

  /** POST /api/score/increment — increment score for a side */
  router.post('/score/increment', (req: Request, res: Response): void => {
    const parsed = SideSchema.safeParse(req.body?.side);
    if (!parsed.success) {
      sendError(res, 400, 'Invalid side — must be "home" or "away"');
      return;
    }
    try {
      const match = matchService.incrementScore(parsed.data);
      res.json({ score: match.currentScore });
    } catch (err) {
      sendError(res, 400, toMessage(err));
    }
  });

  /** POST /api/score/decrement — decrement score for a side (correction) */
  router.post('/score/decrement', (req: Request, res: Response): void => {
    const parsed = SideSchema.safeParse(req.body?.side);
    if (!parsed.success) {
      sendError(res, 400, 'Invalid side — must be "home" or "away"');
      return;
    }
    try {
      const match = matchService.decrementScore(parsed.data);
      res.json({ score: match.currentScore });
    } catch (err) {
      sendError(res, 400, toMessage(err));
    }
  });

  /** POST /api/match/set/complete — complete current set */
  router.post('/match/set/complete', (_req: Request, res: Response): void => {
    try {
      const match = matchService.completeSet();
      res.json(match);
    } catch (err) {
      sendError(res, 400, toMessage(err));
    }
  });

  /** POST /api/match/end — end the match */
  router.post('/match/end', (_req: Request, res: Response): void => {
    try {
      const match = matchService.endMatch();
      res.json(match);
    } catch (err) {
      sendError(res, 400, toMessage(err));
    }
  });

  return router;
}
