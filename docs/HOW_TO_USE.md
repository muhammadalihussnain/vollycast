# How to Use VollyCast

Complete guide for using VollyCast on match day.

**Your laptop IP:** `10.248.125.23`
*(Run `hostname -I | awk '{print $1}'` to confirm — it changes if you switch networks)*

---

## Table of Contents

1. [What You Need](#1-what-you-need)
2. [Match Day Setup](#2-match-day-setup)
3. [Step-by-Step: Start the System](#3-step-by-step-start-the-system)
4. [Step-by-Step: Connect Cameras](#4-step-by-step-connect-cameras)
5. [Step-by-Step: Director Control Panel](#5-step-by-step-director-control-panel)
6. [Step-by-Step: Scorekeeper Phone App](#6-step-by-step-scorekeeper-phone-app)
7. [Step-by-Step: OBS Setup](#7-step-by-step-obs-setup)
8. [Step-by-Step: Go Live on YouTube](#8-step-by-step-go-live-on-youtube)
9. [During the Match](#9-during-the-match)
10. [After the Match](#10-after-the-match)
11. [Quick Reference](#11-quick-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What You Need

| Item | Purpose |
|---|---|
| Laptop (Dell Latitude 5420) | Runs the whole system |
| 1–6 Android phones | Camera feeds |
| Streamlabs app on each camera phone | Streams video to laptop |
| 1 Android phone for scorekeeper | Runs the score controller app |
| Phone hotspot or WiFi router | Connects all devices |
| OBS Studio (optional) | Adds scoreboard overlay to stream |

---

## 2. Match Day Setup

Place cameras around the court:

```
Camera 1 — Side left
Camera 2 — Side right
Camera 3 — Behind net (main angle)
Camera 4 — Elevated rear view
Camera 5 — Close left
Camera 6 — Close right
```

All phones must connect to the **same WiFi or hotspot** as the laptop.

---

## 3. Step-by-Step: Start the System

Open a terminal on the laptop:

```bash
cd /home/muhammad/Documents/volly-ball
docker compose up -d
```

Verify everything is running:
```bash
docker ps
```

You should see 4 containers: `vollycast-nginx-rtmp`, `vollycast-api`, `vollycast-dashboard`, `vollycast-mobile`.

---

## 4. Step-by-Step: Connect Cameras

On **each camera phone**, open **Streamlabs** → Settings → Stream → Custom RTMP:

| Field | Camera 1 | Camera 2 | Camera 3 |
|---|---|---|---|
| Server URL | `rtmp://10.248.125.23:1935/live` | same | same |
| Stream Key | `cam1` | `cam2` | `cam3` |

Tap **Go Live** on each phone.

Then register each camera with the API (run on laptop):
```bash
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'
```

Repeat for cam2, cam3, etc.

Check all cameras are connected:
```bash
curl http://localhost:4000/cameras
```

---

## 5. Step-by-Step: Director Control Panel

Open in browser on the laptop:
```
http://localhost:3000
```

**Camera grid** — shows all connected cameras. Click any camera to switch to it live.

**Scene Switcher** — choose Cut (instant) or Fade (smooth) transition, then click a scene.

**Score panel** — enter team names and click Start Match. Use +/− buttons to score.

**Broadcast panel** — paste your YouTube stream key and click Go Live.

**Health panel** — shows API status, camera count, stream count, broadcast state.

---

## 6. Step-by-Step: Scorekeeper Phone App

On the scorekeeper's phone, open the browser and go to:
```
http://10.248.125.23:3002
```

**Install as an app:**
- Android Chrome: tap menu (⋮) → "Add to Home Screen"
- iPhone Safari: tap Share → "Add to Home Screen"

**Using the app:**
1. Enter PIN: `1234` (default)
2. Enter team names and tap **Start Match**
3. Tap the large `+` buttons to score
4. Tap `−` to undo a point
5. Tap **Complete Set** and confirm when a set ends
6. The app works offline — scores sync when WiFi reconnects

---

## 7. Step-by-Step: OBS Setup

1. Open OBS Studio
2. Create a new Scene called "VollyCast"
3. Add a **Media Source** (for the video):
   - Uncheck "Local File"
   - Input: `http://10.248.125.23:8080/hls/cam1.m3u8`
4. Add a **Browser Source** (for the scoreboard):
   - URL: `http://10.248.125.23:3001`
   - Width: 1920, Height: 1080
   - Check "Shutdown source when not visible"
5. Position the browser source on top of the video

The scoreboard will appear as a transparent overlay.

---

## 8. Step-by-Step: Go Live on YouTube

### Get your YouTube stream key
1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click **Go Live** (top right)
3. Choose **Stream** → Copy your **Stream key**

### Start the broadcast from the dashboard
In the director panel at `http://localhost:3000`:
1. Open **Broadcast** panel
2. Select **YouTube**
3. Paste your stream key
4. Set Input URL: `rtmp://nginx-rtmp:1935/live/cam1`
5. Click **Go Live on YouTube**

Or with curl:
```bash
curl -X POST http://localhost:4000/broadcast/start \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "streamKey": "YOUR_STREAM_KEY",
    "inputUrl": "rtmp://nginx-rtmp:1935/live/cam1"
  }'
```

Check broadcast is live:
```bash
curl http://localhost:4000/broadcast/status
```

---

## 9. During the Match

| Action | How |
|---|---|
| Switch camera angle | Click camera in dashboard or ScenePanel |
| Score a point | Tap + in dashboard or phone app |
| Undo a point | Tap − in dashboard or phone app |
| Complete a set | Tap "Complete Set" in phone app → confirm |
| Check system health | Health panel in dashboard |
| Stop broadcast | Click "Stop Broadcast" in dashboard |

---

## 10. After the Match

```bash
# Stop the broadcast
curl -X POST http://localhost:4000/broadcast/stop

# Stop all containers
docker compose down
```

Recordings are saved in the Docker volume `volly-ball_recordings-data`. To copy them out:
```bash
docker run --rm \
  -v volly-ball_recordings-data:/data \
  -v ~/Desktop/recordings:/output \
  alpine cp -r /data/. /output/
```

---

## 11. Quick Reference

| What | URL / Command |
|---|---|
| Start system | `docker compose up -d` |
| Stop system | `docker compose down` |
| Director dashboard | `http://localhost:3000` |
| Scorekeeper app (phone) | `http://10.248.125.23:3002` |
| Scoreboard overlay (OBS) | `http://10.248.125.23:3001` |
| API health | `http://localhost:4000/health` |
| Camera list | `http://localhost:4000/cameras` |
| Broadcast status | `http://localhost:4000/broadcast/status` |
| Watch cam1 in VLC | `http://10.248.125.23:8080/hls/cam1.m3u8` |
| Scorekeeper PIN | `1234` |

---

## 12. Troubleshooting

**Phone can't connect to RTMP**
- Check phone is on the same WiFi/hotspot as laptop
- Run `hostname -I` to confirm the laptop IP
- Check Docker is running: `docker ps`

**VLC says "cannot open MRL"**
- The phone must be streaming first — tap Go Live before opening VLC
- Wait 3–4 seconds after tapping Go Live before opening VLC

**Scoreboard not updating**
- A match must be created first in the dashboard or app
- Make sure the correct `matchId` is being used

**Broadcast stops reconnecting**
- Reconnects up to 5 times with exponential backoff
- Check your YouTube stream key is correct
- Check your laptop's internet connection

**Docker port already in use**
```bash
docker compose down
lsof -ti:1935 | xargs kill -9
lsof -ti:4000 | xargs kill -9
docker compose up -d
```

**App shows "offline" on the phone**
- The phone's WiFi dropped — score actions are queued locally
- Reconnect WiFi and scores will sync automatically within 5 seconds
