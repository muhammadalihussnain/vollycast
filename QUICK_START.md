# VollyCast Quick Start Guide

## Before you begin — get your IPs

Run this on laptop:
```bash
hostname -I | awk '{print $1}'
```
→ This is your **LAPTOP_IP**

Open IP Webcam on each phone → tap Start server → note the IP shown
→ These are your **PHONE1_IP**, **PHONE2_IP** etc.

---

## Step 1 — Start Docker

```bash
cd /home/muhammad/Documents/volly-ball
docker compose up -d
```

Verify all 4 containers are running:
```bash
docker ps
```

---

## Step 2 — Push cameras to VollyCast

Open one terminal per camera. Replace the placeholders with your actual IPs.

**Camera 1:**
```bash
ffmpeg -i http://PHONE1_IP:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -vf scale=640:480 -b:v 800k \
  -f flv rtmp://localhost:1935/live/cam1
```

**Camera 2:**
```bash
ffmpeg -i http://PHONE2_IP:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -vf scale=640:480 -b:v 800k \
  -f flv rtmp://localhost:1935/live/cam2
```

**Camera 3:**
```bash
ffmpeg -i http://PHONE3_IP:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -vf scale=640:480 -b:v 800k \
  -f flv rtmp://localhost:1935/live/cam3
```

Leave all terminals running.

---

## Step 3 — Verify streams reached nginx

```bash
docker exec vollycast-nginx-rtmp ls /tmp/hls/
```

You must see `cam1.m3u8`, `cam2.m3u8` etc. before continuing.

---

## Step 4 — Register cameras

```bash
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'

curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam2","streamUrl":"rtmp://nginx-rtmp:1935/live/cam2"}'

curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam3","streamUrl":"rtmp://nginx-rtmp:1935/live/cam3"}'
```

---

## Step 5 — Open dashboard in browser

```
http://LAPTOP_IP:3000
```

You will see camera cards with live video. Click any card to switch to that camera.

---

## Step 6 — Scorekeeper app (on phone browser)

```
http://LAPTOP_IP:3002
```

PIN: `1234`

---

## Step 7 — Scoreboard overlay (for OBS)

```
http://LAPTOP_IP:3001
```

Add as Browser Source in OBS. Width: 1920, Height: 1080.

---

## Step 8 — Watch stream in VLC

```
http://LAPTOP_IP:8080/hls/cam1.m3u8
http://LAPTOP_IP:8080/hls/cam2.m3u8
```

---

## Step 9 — Go live on YouTube

1. Get stream key from [studio.youtube.com](https://studio.youtube.com) → Go Live → Stream
2. Open dashboard → Broadcast panel → select YouTube
3. Paste stream key
4. Input URL: `rtmp://nginx-rtmp:1935/live/cam1`
5. Click **Go Live on YouTube**

---

## Stop everything

Press Ctrl+C in each FFmpeg terminal, then:
```bash
docker compose down
```

---

## Troubleshooting

**Connection refused on PHONE_IP:8080**
→ IP Webcam app is not running. Open app on phone and tap Start server.

**HLS folder is empty after FFmpeg starts**
→ Wait 5-10 seconds and check again.

**Duplicate camera cards in dashboard**
→ `docker compose restart vollycast-api` then register cameras once only.

**Phone IP changed**
→ IPs change every time you reconnect to WiFi. Always check IP Webcam app for the current IP.

**Video black in browser but Streaming shown**
→ Run: `curl -s http://localhost:3000/hls/cam1.m3u8 | head -3`
→ Must show `#EXTM3U`. If 404 — FFmpeg stopped, restart it.
