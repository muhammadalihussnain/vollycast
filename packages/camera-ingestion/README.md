# Module 1 — Camera Ingestion Service

Accepts video feeds from camera phones and tracks their status.

## How to Connect a Phone as a Camera

1. Install **DroidCam** (Android) or **EpocCam** (iPhone) on the phone
2. Connect the phone to the same WiFi as the laptop
3. Open DroidCam and note the IP address shown on screen
4. The phone will push an RTMP stream to:
   ```
   rtmp://LAPTOP_IP/live/cam1
   ```
5. Register the camera in code:
   ```ts
   const service = new CameraIngestionService();
   service.start();

   const camera = service.connect({
     name: 'Side Camera Left',
     streamUrl: 'rtmp://192.168.1.10/live/cam1',
   });
   ```

## Events Emitted

| Event | When |
|---|---|
| `camera:connected` | Camera successfully registered and active |
| `camera:disconnected` | Camera gracefully disconnected |
| `camera:error` | Stream timeout — no heartbeat received |
| `stream:health` | Heartbeat received from stream engine |

## Lifecycle

```ts
// Start health monitoring
service.start();

// Connect cameras
const cam = service.connect({ name: 'Cam 1', streamUrl: '...' });

// Stream engine calls this periodically to keep camera alive
service.heartbeat(cam.id);

// On shutdown — always call stop() to clear timers
service.stop();
```

## Test Gate

```bash
pnpm --filter @vollycast/camera-ingestion test
pnpm --filter @vollycast/camera-ingestion coverage
```

Coverage must be >= 90% before moving to Module 2.
