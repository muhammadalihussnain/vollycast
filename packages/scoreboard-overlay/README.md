# Module 3 — Scoreboard Overlay Service

Live score display for the broadcast. Add as a Browser Source in OBS.

## How to Use

### 1. Start the server
```bash
pnpm --filter @vollycast/scoreboard-overlay dev
```

### 2. Add to OBS
- Add a Browser Source
- URL: `http://localhost:3001/overlay`
- Width: 1920, Height: 1080

### 3. Control score via API
```bash
# Create a match
curl -X POST http://localhost:4000/api/match \
  -H "Content-Type: application/json" \
  -d '{"homeTeam":{"name":"DG Khan A","color":"#ff0000"},"awayTeam":{"name":"DG Khan B","color":"#0000ff"}}'

# Start the match
curl -X POST http://localhost:4000/api/match/start

# Increment home score
curl -X POST http://localhost:4000/api/score/increment \
  -H "Content-Type: application/json" \
  -d '{"side":"home"}'
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/match | Create a new match |
| POST | /api/match/start | Start the match |
| GET | /api/match | Get current match state |
| GET | /api/score | Get current score |
| POST | /api/score/increment | Increment score (`{"side":"home"\|"away"}`) |
| POST | /api/score/decrement | Decrement score (correction) |
| POST | /api/match/set/complete | Complete current set |
| POST | /api/match/end | End the match |

## WebSocket Events (sent to overlay)

| Event | When |
|---|---|
| `score:update` | Every score change |
| `match:started` | Match goes live |
| `match:completed` | Match ends |
| `set:completed` | Set ends |

## Test Gate

```bash
pnpm --filter @vollycast/scoreboard-overlay test
pnpm --filter @vollycast/scoreboard-overlay coverage
```

Score update must reach overlay within 200ms. Coverage >= 90%.
