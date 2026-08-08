/**
 * MatchService — Task 3.1 & 3.2
 *
 * Manages match lifecycle and score state.
 * Design pattern: Repository — all state mutations go through this service.
 * Observer: emits events through EventBus on every state change.
 */

import { randomUUID } from 'node:crypto';
import {
  EventBus,
  VOLLYCAST_EVENTS,
  SCORE,
  type Match,
  type Team,
  type Score,
  type TeamSide,
  type ScoreEventPayload,
  type MatchStatus,
} from '@vollycast/shared';
import { logger } from './logger.js';

export interface CreateMatchOptions {
  readonly homeTeam: Omit<Team, 'id'>;
  readonly awayTeam: Omit<Team, 'id'>;
}

export class MatchService {
  private match: Match | null = null;
  private readonly bus: EventBus;

  public constructor(bus?: EventBus) {
    this.bus = bus ?? EventBus.getInstance();
  }

  /**
   * Create a new match and set it as the active match.
   * Replaces any previous match.
   */
  public createMatch(options: CreateMatchOptions): Match {
    const match: Match = {
      id: randomUUID(),
      homeTeam: { id: randomUUID(), ...options.homeTeam },
      awayTeam: { id: randomUUID(), ...options.awayTeam },
      currentScore: { home: SCORE.MIN_POINTS, away: SCORE.MIN_POINTS },
      sets: [],
      currentSet: 1,
      status: 'pending',
    };

    this.match = match;
    logger.info({ matchId: match.id }, 'Match created');
    return this.cloneMatch(match);
  }

  /**
   * Start the active match.
   */
  public startMatch(): Match {
    const match = this.getActiveMatch();
    if (match.status !== 'pending') {
      throw new Error(`Cannot start match in status: ${match.status}`);
    }
    match.status = 'live';
    match.startedAt = new Date();
    this.bus.emit(VOLLYCAST_EVENTS.MATCH_STARTED, { matchId: match.id });
    logger.info({ matchId: match.id }, 'Match started');
    return this.cloneMatch(match);
  }

  /**
   * Increment score for the given team side.
   */
  public incrementScore(side: TeamSide): Match {
    const match = this.getActiveMatch();
    this.assertLive(match);

    const current = match.currentScore[side];
    if (current >= SCORE.MAX_POINTS_PER_SET) {
      throw new Error(`Score already at maximum: ${SCORE.MAX_POINTS_PER_SET}`);
    }

    match.currentScore = {
      ...match.currentScore,
      [side]: current + 1,
    };

    this.emitScoreUpdate(match);
    logger.info({ matchId: match.id, side, score: match.currentScore }, 'Score incremented');
    return this.cloneMatch(match);
  }

  /**
   * Decrement score for the given team side (correction).
   */
  public decrementScore(side: TeamSide): Match {
    const match = this.getActiveMatch();
    this.assertLive(match);

    const current = match.currentScore[side];
    if (current <= SCORE.MIN_POINTS) {
      throw new Error(`Score already at minimum: ${SCORE.MIN_POINTS}`);
    }

    match.currentScore = {
      ...match.currentScore,
      [side]: current - 1,
    };

    this.emitScoreUpdate(match);
    logger.info({ matchId: match.id, side, score: match.currentScore }, 'Score decremented');
    return this.cloneMatch(match);
  }

  /**
   * Complete the current set and start the next one.
   */
  public completeSet(): Match {
    const match = this.getActiveMatch();
    this.assertLive(match);

    match.sets.push({
      setNumber: match.currentSet,
      score: { ...match.currentScore },
      completedAt: new Date(),
    });

    match.currentSet += 1;
    match.currentScore = { home: SCORE.MIN_POINTS, away: SCORE.MIN_POINTS };

    this.bus.emit(VOLLYCAST_EVENTS.SET_COMPLETED, {
      matchId: match.id,
      setNumber: match.currentSet - 1,
    });

    logger.info({ matchId: match.id, currentSet: match.currentSet }, 'Set completed');
    return this.cloneMatch(match);
  }

  /**
   * End the match.
   */
  public endMatch(): Match {
    const match = this.getActiveMatch();
    match.status = 'completed';
    match.completedAt = new Date();
    this.bus.emit(VOLLYCAST_EVENTS.MATCH_COMPLETED, { matchId: match.id });
    logger.info({ matchId: match.id }, 'Match completed');
    return this.cloneMatch(match);
  }

  /**
   * Get the current match state. Returns null if no match exists.
   */
  public getMatch(): Match | null {
    return this.match !== null ? this.cloneMatch(this.match) : null;
  }

  /**
   * Get the current score. Throws if no active match.
   */
  public getScore(): Score {
    return { ...this.getActiveMatch().currentScore };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private getActiveMatch(): Match {
    if (this.match === null) {
      throw new Error('No active match');
    }
    return this.match;
  }

  private assertLive(match: Match): void {
    if (match.status !== 'live') {
      throw new Error(`Match is not live. Current status: ${match.status}`);
    }
  }

  private emitScoreUpdate(match: Match): void {
    const payload: ScoreEventPayload = {
      matchId: match.id,
      score: { ...match.currentScore },
      setNumber: match.currentSet,
    };
    this.bus.emit(VOLLYCAST_EVENTS.SCORE_UPDATED, payload);
  }

  /** Return a deep clone so callers cannot mutate internal state */
  private cloneMatch(match: Match): Match {
    return {
      ...match,
      homeTeam: { ...match.homeTeam },
      awayTeam: { ...match.awayTeam },
      currentScore: { ...match.currentScore },
      sets: match.sets.map((s) => ({ ...s, score: { ...s.score } })),
    };
  }
}

export type { MatchStatus };
