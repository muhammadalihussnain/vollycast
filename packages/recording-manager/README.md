# Module 6 — Recording Manager

Records every camera feed automatically, segmented by match and set.

## Usage

```ts
import { RecordingManager } from '@vollycast/recording-manager';

const manager = new RecordingManager({
  recordingsPath: './recordings',
});

manager.start(); // listens to MATCH_STARTED, CAMERA_CONNECTED, etc.

// On shutdown
manager.stop();
```

## Recordings Location

```
recordings/
└── MATCH_ID/
    ├── set1-cam-1-1234567890.mp4
    ├── set1-cam-2-1234567890.mp4
    └── set2-cam-1-1234567890.mp4
```

## Events

| Listens to | Action |
|---|---|
| `match:started` | Activates recording for new cameras |
| `camera:connected` | Starts recording if match is live |
| `camera:disconnected` | Stops recording for that camera |
| `set:completed` | Increments set counter for new filenames |
| `match:completed` | Stops all recordings |

| Emits | When |
|---|---|
| `recording:started` | Recording session begins |
| `recording:stopped` | Recording session ends |
| `disk:space:warning` | Disk usage >= 85% |

## Test Gate

```bash
pnpm --filter @vollycast/recording-manager test
pnpm --filter @vollycast/recording-manager coverage
```
