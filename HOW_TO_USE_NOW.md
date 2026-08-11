# How to Use VollyCast Right Now

Your laptop IP: **10.177.87.23**
*(Run `hostname -I | awk '{print $1}'` to confirm)*

---

## What you need

| Item | What it is |
|---|---|
| Your laptop | Runs VollyCast |
| Android phone(s) | Camera — needs **DroidCam** app installed |
| DroidCam app | Free on Play Store by Dev47Apps |
| Phone hotspot | Connects phone and laptop on same network |

---

## Step 1 — Start VollyCast

```bash
cd /home/muhammad/Documents/volly-ball
docker compose up -d
```

---

## Step 2 — Connect phone camera (DroidCam)

**On phone:** Open DroidCam app → note the WiFi IP shown → tap Start

**Terminal 1 — connect:**
```bash
droidcam-cli 10.177.87.79 4747
```
Note the video device shown (e.g. `/dev/video4`)

**Terminal 2 — push to VollyCast:**
```bash
ffmpeg -f v4l2 -i /dev/video4 \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv rtmp://localhost:1935/live/cam1
```

**Terminal 3 — register camera (once only):**
```bash
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'
```

---

## Step 3 — Watch stream in VLC

```
http://10.177.87.23:8080/hls/cam1.m3u8
```

---

## Step 4 — Open director dashboard

```
http://10.177.87.23:3000
```

---

## Step 5 — Open scorekeeper app on phone

```
http://10.177.87.23:3002
```
PIN: `1234`

---

## Step 6 — Scoreboard overlay in OBS

Add Browser Source → URL: `http://10.177.87.23:3001`

---

## Step 7 — Go live on YouTube

In dashboard Broadcast panel:
- Select YouTube
- Paste your stream key
- Input URL: `rtmp://nginx-rtmp:1935/live/cam1`
- Click Go Live

---

## Stop everything

```bash
docker compose down
```
