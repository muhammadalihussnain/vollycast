# How to Use VollyCast Right Now

Get your laptop IP first:
```bash
hostname -I | awk '{print $1}'
```

---

## What you need on each camera phone

Install **IP Webcam** from Google Play Store (free, by Pavel Khlebovich).

---

## Step 1 — Start VollyCast

```bash
cd /home/muhammad/Documents/volly-ball
docker compose up -d
```

---

## Step 2 — Connect a camera phone

**On phone:** Open IP Webcam → scroll to bottom → tap **Start server**
Note the IP shown (e.g. `http://192.168.0.196:8080`)

**On laptop (one terminal per camera):**
```bash
# Camera 1
ffmpeg -i http://192.168.0.196:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv rtmp://localhost:1935/live/cam1

# Camera 2
ffmpeg -i http://192.168.0.202:8080/video \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv rtmp://localhost:1935/live/cam2
```

**Verify stream reached nginx:**
```bash
docker exec vollycast-nginx-rtmp ls /tmp/hls/
```
Must show `cam1.m3u8` before registering.

**Register camera (once per camera):**
```bash
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'
```

---

## Step 3 — Open director dashboard

```
http://<LAPTOP_IP>:3000
```

Click a camera card to switch to it. Live video shows in each card.

---

## Step 4 — Scorekeeper phone app

```
http://<LAPTOP_IP>:3002
```
PIN: `1234`

---

## Step 5 — Scoreboard overlay in OBS

Add Browser Source → URL: `http://<LAPTOP_IP>:3001`

---

## Step 6 — Go live on YouTube

In dashboard Broadcast panel:
- Select YouTube → paste stream key
- Input URL: `rtmp://nginx-rtmp:1935/live/cam1`
- Click Go Live on YouTube

---

## Stop everything

```bash
docker compose down
```
