import { describe, it, expect, beforeEach } from 'vitest';
import { MatchService } from './MatchService.js';
import { EventBus, VOLLYCAST_EVENTS } from '@vollycast/shared';
import type { ScoreEventPayload } from '@vollycast/shared';

const HOME = { name: 'Team A', color: '#ff0000' };
const AWAY = { name: 'Team B', color: '#0000ff' };

describe('MatchService', () => {
  let service: MatchService;
  let bus: EventBus;

  beforeEach(() => {
    EventBus.resetForTesting();
    bus = EventBus.getInstance();
    service = new MatchService(bus);
  });

  // ─── createMatch ──────────────────────────────────────────────────────────────

  it('creates a match with correct team names', () => {
    const match = service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    expect(match.homeTeam.name).toBe('Team A');
    expect(match.awayTeam.name).toBe('Team B');
  });

  it('creates a match with zero score', () => {
    const match = service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    expect(match.currentScore).toEqual({ home: 0, away: 0 });
  });

  it('creates a match with pending status', () => {
    const match = service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    expect(match.status).toBe('pending');
  });

  it('assigns unique IDs to teams and match', () => {
    const m1 = service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    const m2 = service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    expect(m1.id).not.toBe(m2.id);
    expect(m1.homeTeam.id).not.toBe(m2.homeTeam.id);
  });

  // ─── startMatch ───────────────────────────────────────────────────────────────

  it('starts a match and sets status to live', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    const match = service.startMatch();
    expect(match.status).toBe('live');
  });

  it('emits MATCH_STARTED event', () => {
    let fired = false;
    bus.on(VOLLYCAST_EVENTS.MATCH_STARTED, () => { fired = true; });
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    expect(fired).toBe(true);
  });

  it('throws if starting a match that is already live', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    expect(() => service.startMatch()).toThrow('Cannot start match in status: live');
  });

  it('throws startMatch with no active match', () => {
    expect(() => service.startMatch()).toThrow('No active match');
  });

  // ─── incrementScore ───────────────────────────────────────────────────────────

  it('increments home score', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    const match = service.incrementScore('home');
    expect(match.currentScore.home).toBe(1);
    expect(match.currentScore.away).toBe(0);
  });

  it('increments away score', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    const match = service.incrementScore('away');
    expect(match.currentScore.away).toBe(1);
  });

  it('emits SCORE_UPDATED event on increment', () => {
    const events: ScoreEventPayload[] = [];
    bus.on<ScoreEventPayload>(VOLLYCAST_EVENTS.SCORE_UPDATED, (p) => events.push(p));
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    service.incrementScore('home');
    expect(events).toHaveLength(1);
    expect(events[0]?.score.home).toBe(1);
  });

  it('throws increment when match is not live', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    expect(() => service.incrementScore('home')).toThrow('Match is not live');
  });

  it('throws increment at max score', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    // Set score to max via repeated increments
    for (let i = 0; i < 25; i++) service.incrementScore('home');
    expect(() => service.incrementScore('home')).toThrow('Score already at maximum');
  });

  // ─── decrementScore ───────────────────────────────────────────────────────────

  it('decrements score correctly', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    service.incrementScore('home');
    service.incrementScore('home');
    const match = service.decrementScore('home');
    expect(match.currentScore.home).toBe(1);
  });

  it('emits SCORE_UPDATED event on decrement', () => {
    const events: ScoreEventPayload[] = [];
    bus.on<ScoreEventPayload>(VOLLYCAST_EVENTS.SCORE_UPDATED, (p) => events.push(p));
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    service.incrementScore('away');
    service.decrementScore('away');
    expect(events).toHaveLength(2);
  });

  it('throws decrement at zero', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    expect(() => service.decrementScore('home')).toThrow('Score already at minimum');
  });

  // ─── completeSet ──────────────────────────────────────────────────────────────

  it('completes set and resets score', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    service.incrementScore('home');
    const match = service.completeSet();
    expect(match.currentScore).toEqual({ home: 0, away: 0 });
    expect(match.sets).toHaveLength(1);
    expect(match.sets[0]?.score.home).toBe(1);
  });

  it('increments currentSet after completeSet', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    const match = service.completeSet();
    expect(match.currentSet).toBe(2);
  });

  it('emits SET_COMPLETED event', () => {
    let fired = false;
    bus.on(VOLLYCAST_EVENTS.SET_COMPLETED, () => { fired = true; });
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    service.completeSet();
    expect(fired).toBe(true);
  });

  // ─── endMatch ─────────────────────────────────────────────────────────────────

  it('ends match and sets status to completed', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    const match = service.endMatch();
    expect(match.status).toBe('completed');
  });

  it('emits MATCH_COMPLETED event', () => {
    let fired = false;
    bus.on(VOLLYCAST_EVENTS.MATCH_COMPLETED, () => { fired = true; });
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    service.endMatch();
    expect(fired).toBe(true);
  });

  // ─── getMatch / getScore ──────────────────────────────────────────────────────

  it('getMatch returns null before any match is created', () => {
    expect(service.getMatch()).toBeNull();
  });

  it('getMatch returns a copy — mutation does not affect internal state', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    const match = service.getMatch()!;
    match.currentScore = { home: 99, away: 99 };
    expect(service.getMatch()?.currentScore).toEqual({ home: 0, away: 0 });
  });

  it('getScore throws with no active match', () => {
    expect(() => service.getScore()).toThrow('No active match');
  });

  it('getScore returns current score', () => {
    service.createMatch({ homeTeam: HOME, awayTeam: AWAY });
    service.startMatch();
    service.incrementScore('away');
    expect(service.getScore()).toEqual({ home: 0, away: 1 });
  });
});
