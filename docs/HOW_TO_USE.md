# How to Use VollyCast

Complete guide for using VollyCast on match day.

**Your laptop IP:** `10.177.87.23`
*(Run `hostname -I | awk '{print $1}'` to confirm — it changes if you switch networks)*

---

## Table of Contents

1. [What You Need](#1-what-you-need)
2. [Match Day Setup](#2-match-day-setup)
3. [Step-by-Step: Start the System](#3-step-by-step-start-the-system)
4. [Step-by-Step: Connect Cameras with DroidCam](#4-step-by-step-connect-cameras-with-droidcam)
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
| **DroidCam** app on each camera phone | Streams video from phone to laptop over WiFi |
| 1 Android phone for scorekeeper | Runs the score controller app |
| Phone hotspot or WiFi router | Connects all devices |
| OBS Studio (optional) | Adds scoreboard overlay to stream |

Install DroidCam on each camera phone:
- Android: search "DroidCam" by Dev47Apps on Play Store (free)

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

```bash
cd /home/muhammad/Documents/volly-ball
docker compose up -d
docker ps
```

You should see 4 containers running: `vollycast-nginx-rtmp`, `vollycast-api`, `vollycast-dashboard`, `vollycast-mobile`.

---

## 4. Step-by-Step: Connect Cameras with DroidCam

Repeat these steps for each camera phone.

### On the phone
1. Open **DroidCam** app
2. Make sure phone is on same WiFi/hotspot as laptop
3. Note the **WiFi IP** shown (e.g. `10.177.87.79`)
4. Tap **Start**

### On the laptop — Terminal 1 (connect DroidCam)
```bash
droidcam-cli 10.177.87.79 4747
```

It will show the video device:
```
Video: /dev/video4
```

Leave this terminal running.

### On the laptop — Terminal 2 (push to VollyCast)
```bash
ffmpeg -f v4l2 -i /dev/video4 \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv rtmp://localhost:1935/live/cam1
```

Replace `/dev/video4` with whatever device appeared above.
Replace `cam1` with `cam2`, `cam3` etc. for each camera.

Leave this terminal running.

### On the laptop — Terminal 3 (register camera)
```bash
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'
```

The camera will appear in the dashboard and stay **active** as long as FFmpeg is running.

### Verify in VLC
Open VLC → Media → Open Network Stream:
```
http://10.177.87.23:8080/hls/cam1.m3u8
```

You will see the phone camera live within 3-4 seconds.

---

## 5. Step-by-Step: Director Control Panel

Open in browser:
```
http://10.177.87.23:3000
```

- **Camera grid** — shows all connected cameras. Click any to switch to it live.
- **Scene Switcher** — choose Cut (instant) or Fade transition, click a scene.
- **Score panel** — enter team names, click Start Match, use +/− to score.
- **Broadcast panel** — paste YouTube key and click Go Live.
- **Health panel** — shows API, cameras, streams, broadcast state.

---

## 6. Step-by-Step: Scorekeeper Phone App

On the scorekeeper's phone, open browser:
```
http://10.177.87.23:3002
```

**Install as app:**
- Android Chrome: tap menu (⋮) → "Add to Home Screen"

**Using the app:**
1. Enter PIN: `1234`
2. Enter team names → tap **Start Match**
3. Tap large `+` to score, `−` to undo
4. Tap **Complete Set** and confirm when a set ends
5. Works offline — syncs when WiFi reconnects

---

## 7. Step-by-Step: OBS Setup

1. Open OBS → add **Media Source**:
   - Input: `http://10.177.87.23:8080/hls/cam1.m3u8`
2. Add **Browser Source** (scoreboard overlay):
   - URL: `http://10.177.87.23:3001`
   - Width: 1920, Height: 1080

---

## 8. Step-by-Step: Go Live on YouTube

Get your stream key from [YouTube Studio](https://studio.youtube.com) → Go Live → Stream → copy Stream key.

In the dashboard Broadcast panel:
1. Select **YouTube**
2. Paste stream key
3. Set Input URL: `rtmp://nginx-rtmp:1935/live/cam1`
4. Click **Go Live on YouTube**

---

## 9. During the Match

| Action | How |
|---|---|
| Switch camera | Click camera in dashboard |
| Score a point | Tap + in dashboard or phone app |
| Undo a point | Tap − in dashboard or phone app |
| Complete a set | Tap "Complete Set" in phone app → confirm |
| Stop broadcast | Click "Stop Broadcast" in dashboard |

---

## 10. After the Match

```bash
docker compose down
```

Copy recordings:
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
| Director dashboard | `http://10.177.87.23:3000` |
| Scorekeeper app (phone) | `http://10.177.87.23:3002` |
| Scoreboard overlay (OBS) | `http://10.177.87.23:3001` |
| API health | `http://localhost:4000/health` |
| Camera list | `http://localhost:4000/cameras` |
| Watch cam1 in VLC | `http://10.177.87.23:8080/hls/cam1.m3u8` |
| Scorekeeper PIN | `1234` |
| Connect DroidCam | `droidcam-cli <PHONE_IP> 4747` |
| Push camera to VollyCast | `ffmpeg -f v4l2 -i /dev/video4 -vcodec libx264 -preset ultrafast -tune zerolatency -f flv rtmp://localhost:1935/live/cam1` |

---

## 12. Troubleshooting

**DroidCam not connecting**
- Phone and laptop must be on same WiFi/hotspot
- Check IP shown in DroidCam app matches what you type in `droidcam-cli`

**Camera shows "Error" in dashboard**
- FFmpeg must be running and pushing to nginx first
- Check: `docker exec vollycast-nginx-rtmp ls /tmp/hls/` — you should see `cam1.m3u8`

**VLC shows "cannot open MRL"**
- FFmpeg must be running first before opening VLC
- Wait 3-4 seconds after starting FFmpeg

**Multiple duplicate cameras in dashboard**
- Restart API to clear: `docker compose restart vollycast-api`
- Then register each camera only once

**App shows "offline" on phone**
- Scores queue locally and sync when WiFi reconnects automatically

**Docker port already in use**
```bash
docker compose down
docker compose up -d
```
