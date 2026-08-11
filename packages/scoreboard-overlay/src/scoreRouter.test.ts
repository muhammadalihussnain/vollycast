import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { EventBus } from '@vollycast/shared';
import { MatchService } from './MatchService.js';
import { createApp } from './app.js';
import type { Express } from 'express';

describe('scoreRouter', () => {
  let app: Express;
  let matchService: MatchService;

  beforeEach(() => {
    EventBus.resetForTesting();
    matchService = new MatchService(EventBus.getInstance());
    app = createApp(matchService);
  });

  // ─── health ───────────────────────────────────────────────────────────────────

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  // ─── POST /api/match ──────────────────────────────────────────────────────────

  it('creates a match with valid body', async () => {
    const res = await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    expect(res.status).toBe(201);
    expect(res.body.homeTeam.name).toBe('Team A');
    expect(res.body.status).toBe('pending');
  });

  it('returns 400 for missing team name', async () => {
    const res = await request(app).post('/api/match').send({
      homeTeam: { color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid color format', async () => {
    const res = await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: 'red' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    expect(res.status).toBe(400);
  });

  // ─── POST /api/match/start ────────────────────────────────────────────────────

  it('starts a match', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    const res = await request(app).post('/api/match/start');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('live');
  });

  it('returns 400 starting with no match', async () => {
    const res = await request(app).post('/api/match/start');
    expect(res.status).toBe(400);
  });

  // ─── GET /api/match ───────────────────────────────────────────────────────────

  it('GET /api/match returns 404 with no match', async () => {
    const res = await request(app).get('/api/match');
    expect(res.status).toBe(404);
  });

  it('GET /api/match returns match after creation', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    const res = await request(app).get('/api/match');
    expect(res.status).toBe(200);
    expect(res.body.homeTeam.name).toBe('Team A');
  });

  // ─── GET /api/score ───────────────────────────────────────────────────────────

  it('GET /api/score returns 404 with no match', async () => {
    const res = await request(app).get('/api/score');
    expect(res.status).toBe(404);
  });

  it('GET /api/score returns score', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    const res = await request(app).get('/api/score');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ home: 0, away: 0 });
  });

  // ─── POST /api/score/increment ────────────────────────────────────────────────

  it('increments home score', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    await request(app).post('/api/match/start');
    const res = await request(app).post('/api/score/increment').send({ side: 'home' });
    expect(res.status).toBe(200);
    expect(res.body.score.home).toBe(1);
  });

  it('returns 400 for invalid side on increment', async () => {
    const res = await request(app).post('/api/score/increment').send({ side: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 400 incrementing when match not live', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    const res = await request(app).post('/api/score/increment').send({ side: 'home' });
    expect(res.status).toBe(400);
  });

  // ─── POST /api/score/decrement ────────────────────────────────────────────────

  it('decrements score correctly', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    await request(app).post('/api/match/start');
    await request(app).post('/api/score/increment').send({ side: 'away' });
    const res = await request(app).post('/api/score/decrement').send({ side: 'away' });
    expect(res.status).toBe(200);
    expect(res.body.score.away).toBe(0);
  });

  it('returns 400 for invalid side on decrement', async () => {
    const res = await request(app).post('/api/score/decrement').send({ side: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 400 decrementing when match not live', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    const res = await request(app).post('/api/score/decrement').send({ side: 'home' });
    expect(res.status).toBe(400);
  });

  it('returns 400 completing set when match not live', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    const res = await request(app).post('/api/match/set/complete');
    expect(res.status).toBe(400);
  });

  it('returns 400 ending match when no active match', async () => {
    const res = await request(app).post('/api/match/end');
    expect(res.status).toBe(400);
  });

  // ─── POST /api/match/set/complete ─────────────────────────────────────────────

  it('completes set and resets score', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    await request(app).post('/api/match/start');
    const res = await request(app).post('/api/match/set/complete');
    expect(res.status).toBe(200);
    expect(res.body.currentScore).toEqual({ home: 0, away: 0 });
    expect(res.body.sets).toHaveLength(1);
  });

  // ─── POST /api/match/end ──────────────────────────────────────────────────────

  it('ends the match', async () => {
    await request(app).post('/api/match').send({
      homeTeam: { name: 'Team A', color: '#ff0000' },
      awayTeam: { name: 'Team B', color: '#0000ff' },
    });
    await request(app).post('/api/match/start');
    const res = await request(app).post('/api/match/end');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});
