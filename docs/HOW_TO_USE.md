# How to Use VollyCast

Complete guide for using VollyCast on match day.

**Your laptop IP:** Run this to get it:
```bash
hostname -I | awk '{print $1}'
```
It changes when you switch networks. Use that IP everywhere below.

---

## Table of Contents

1. [What You Need](#1-what-you-need)
2. [Match Day Setup](#2-match-day-setup)
3. [Step-by-Step: Start the System](#3-step-by-step-start-the-system)
4. [Step-by-Step: Connect Cameras with IP Webcam](#4-step-by-step-connect-cameras-with-ip-webcam)
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
| **IP Webcam** app on each camera phone | Streams video from phone over WiFi — free, no account needed |
| 1 Android phone for scorekeeper | Runs the score controller app |
| WiFi router or phone hotspot | Connects all devices on same network |
| OBS Studio (optional) | Adds scoreboard overlay to stream |

**Install IP Webcam on each camera phone:**
- Search **"IP Webcam"** on Google Play Store
- Developer: Pavel Khlebovich
- Free, no watermark, no time limit

---

## 2. Match Day Setup

All phones and the laptop must be on the **same WiFi network**.

Place cameras around the court:
```
Camera 1 — Side left      (cam1)
Camera 2 — Side right     (cam2)
Camera 3 — Behind net     (cam3)
Camera 4 — Elevated rear  (cam4)
Camera 5 — Close left     (cam5)
Camera 6 — Close right    (cam6)
```

---

## 3. Step-by-Step: Start the System

```bash
cd /home/muhammad/Documents/volly-ball
docker compose up -d
```

Verify all containers are running:
```bash
docker ps
```

You should see 4 containers: `vollycast-nginx-rtmp`, `vollycast-api`, `vollycast-dashboard`, `vollycast-mobile`.

---

## 4. Step-by-Step: Connect Cameras with IP Webcam

Repeat for each camera phone.

### On the phone

1. Open **IP Webcam** app
2. Make sure phone is on same WiFi as laptop
3. Scroll to the bottom
4. Tap **Start server**
5. Note the IP shown on screen (e.g. `http://192.168.0.196:8080`)

### On the laptop — one terminal per camera

Push the phone camera to VollyCast:
```bash
# Camera 1
ffmpeg -i http://192.168.0.196:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv rtmp://localhost:1935/live/cam1
```

Replace `192.168.0.196` with the IP shown in IP Webcam on that phone.
Replace `cam1` with `cam2`, `cam3` etc. for each additional camera.

Leave each terminal running.

### Verify the stream reached nginx

```bash
docker exec vollycast-nginx-rtmp ls /tmp/hls/
```

You must see `cam1.m3u8` before registering.

### Register the camera with VollyCast

```bash
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'
```

The camera appears in the dashboard with a live video preview.

### Example — 2 cameras running simultaneously

**Terminal 1:**
```bash
ffmpeg -i http://192.168.0.196:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv rtmp://localhost:1935/live/cam1
```

**Terminal 2:**
```bash
ffmpeg -i http://192.168.0.202:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv rtmp://localhost:1935/live/cam2
```

**Register both:**
```bash
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'

curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam2","streamUrl":"rtmp://nginx-rtmp:1935/live/cam2"}'
```

---

## 5. Step-by-Step: Director Control Panel

Open in browser on the laptop:
```
http://<LAPTOP_IP>:3000
```

**Camera grid** — shows all cameras with live video preview. Click any camera card to switch to it.

**Scene Switcher** — choose **Cut** (instant) or **Fade** (smooth), click a scene button.

**Score panel** — enter team names, click **Start Match**, use +/− buttons to score.

**Broadcast panel** — paste YouTube/Facebook stream key, click **Go Live**.

**Health panel** — shows API status, camera count, stream count, broadcast state.

---

## 6. Step-by-Step: Scorekeeper Phone App

On the scorekeeper's phone, open browser:
```
http://<LAPTOP_IP>:3002
```

**Install as app on phone:**
- Android Chrome: tap menu (⋮) → "Add to Home Screen"

**Using the app:**
1. Enter PIN: `1234`
2. Enter team names → tap **Start Match**
3. Tap large **+** to score, **−** to undo
4. Tap **Complete Set** → confirm when a set ends
5. Works offline — scores queue and sync when WiFi reconnects

---

## 7. Step-by-Step: OBS Setup

1. Open OBS → Sources → **+** → **Media Source**
   - Uncheck "Local File"
   - Input: `http://<LAPTOP_IP>:8080/hls/cam1.m3u8`

2. Sources → **+** → **Browser Source** (scoreboard overlay)
   - URL: `http://<LAPTOP_IP>:3001`
   - Width: 1920, Height: 1080

The scoreboard appears as a transparent overlay on the video.

---

## 8. Step-by-Step: Go Live on YouTube

**Get your stream key:**
1. Go to [studio.youtube.com](https://studio.youtube.com)
2. Click **Go Live** → **Stream**
3. Copy your **Stream key**

**Start broadcast from dashboard:**
1. Open `http://<LAPTOP_IP>:3000`
2. Broadcast panel → select **YouTube**
3. Paste stream key
4. Input URL: `rtmp://nginx-rtmp:1935/live/cam1`
5. Click **Go Live on YouTube**

**Go live on Facebook:**
Same steps — select **Facebook**, paste Facebook stream key.

---

## 9. During the Match

| Action | How |
|---|---|
| Switch camera angle | Click camera card in dashboard |
| Cut transition (instant) | Select CUT in Scene Switcher, click scene |
| Fade transition (smooth) | Select FADE in Scene Switcher, click scene |
| Score a point | Tap + in dashboard or scorekeeper app |
| Undo a point | Tap − in dashboard or scorekeeper app |
| Complete a set | Tap "Complete Set" in scorekeeper app → confirm |
| Stop broadcast | Click "Stop Broadcast" in dashboard |

---

## 10. After the Match

```bash
# Stop the broadcast first
curl -X POST http://localhost:4000/broadcast/stop

# Stop all containers
docker compose down
```

Copy recordings to Desktop:
```bash
docker run --rm \
  -v volly-ball_recordings-data:/data \
  -v ~/Desktop/recordings:/output \
  alpine cp -r /data/. /output/
```

---

## 11. Quick Reference

| What | Command / URL |
|---|---|
| Get laptop IP | `hostname -I \| awk '{print $1}'` |
| Start system | `docker compose up -d` |
| Stop system | `docker compose down` |
| Director dashboard | `http://<LAPTOP_IP>:3000` |
| Scorekeeper app | `http://<LAPTOP_IP>:3002` |
| Scoreboard overlay (OBS) | `http://<LAPTOP_IP>:3001` |
| API health check | `http://localhost:4000/health` |
| Camera list | `http://localhost:4000/cameras` |
| Broadcast status | `http://localhost:4000/broadcast/status` |
| Watch cam1 in VLC | `http://<LAPTOP_IP>:8080/hls/cam1.m3u8` |
| Scorekeeper PIN | `1234` |
| Check HLS files | `docker exec vollycast-nginx-rtmp ls /tmp/hls/` |
| Clear cameras | `docker compose restart vollycast-api` |

---

## 12. Troubleshooting

**Camera shows "Error" in dashboard but stream works in VLC**
- This is normal — the heartbeat system expects a local stream
- The video is actually live — click the camera card to switch to it
- The live preview in the dashboard card shows the real video

**IP Webcam not reachable from laptop**
- Both must be on the same WiFi network
- Check: `ping <PHONE_IP>` from laptop
- If ping fails, they are on different networks

**VLC shows "cannot open MRL"**
- FFmpeg must be running first
- Run: `docker exec vollycast-nginx-rtmp ls /tmp/hls/`
- You must see `cam1.m3u8` before opening VLC

**Multiple duplicate cameras in dashboard**
```bash
docker compose restart vollycast-api
```
Then register each camera only once.

**FFmpeg error: "Connection refused"**
- Docker is not running: `docker compose up -d`
- Or wrong port — must be `rtmp://localhost:1935/live/cam1`

**Broadcast stopped reconnecting**
- Auto-reconnects up to 5 times
- Check YouTube stream key is correct
- Check laptop internet connection

**Docker port already in use**
```bash
docker compose down
lsof -ti:4000 | xargs kill -9
docker compose up -d
```
