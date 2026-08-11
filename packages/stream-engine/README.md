# Module 2 — Stream Engine

Transcodes camera feeds using FFmpeg and forwards them to the local RTMP server.

## How It Works

1. Listens for `CAMERA_CONNECTED` events from Module 1
2. Spawns an FFmpeg process per camera using the configured quality profile
3. Transcodes input RTMP → output RTMP (forwarded to nginx)
4. Monitors stream health and emits `STREAM_HEALTH` events
5. Cleans up FFmpeg processes on `CAMERA_DISCONNECTED`

## Quality Profiles

| Profile | Video Bitrate | Resolution | FPS |
|---|---|---|---|
| low | 800 kbps | 854×480 | 25 |
| medium | 2500 kbps | 1280×720 | 30 |
| high | 5000 kbps | 1920×1080 | 30 |

## Usage

```ts
import { StreamEngine } from '@vollycast/stream-engine';
import { EventBus } from '@vollycast/shared';

const engine = new StreamEngine({
  defaultProfile: 'medium',
  rtmpHost: 'localhost',
});

engine.start(); // subscribes to camera events automatically

// On shutdown — always call stop() to clean up FFmpeg processes
engine.stop();
```

## Test Gate

```bash
pnpm --filter @vollycast/stream-engine test
pnpm --filter @vollycast/stream-engine coverage
```

Coverage must be >= 90% before moving to Module 3.
