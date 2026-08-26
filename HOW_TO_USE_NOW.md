# How to Use VollyCast Right Now

## Start everything with one command

```bash
cd /home/muhammad/Documents/volly-ball
./scripts/start.sh
```

It will ask:
1. How many cameras? (enter 1, 2, 3... up to 6)
2. The IP address of each phone from IP Webcam app

That's it. Everything starts automatically.

---

## What you need on each camera phone

1. Install **IP Webcam** from Google Play Store (free, by Pavel Khlebovich)
2. Open app → scroll to bottom → tap **Start server**
3. Note the IP shown (e.g. `192.168.0.196`)
4. Give that IP to the start script when asked

---

## After the script starts

The script shows all URLs:

| What | URL |
|---|---|
| Director dashboard | `http://<LAPTOP_IP>:3000` |
| Scorekeeper app | `http://<LAPTOP_IP>:3002` |
| Scoreboard overlay (OBS) | `http://<LAPTOP_IP>:3001` |
| Watch in VLC | `http://<LAPTOP_IP>:8080/hls/cam1.m3u8` |

---

## Stop everything

Press **Ctrl+C** in the terminal where `./scripts/start.sh` is running.

It stops FFmpeg and Docker automatically.

---

## Important rules

- Phone and laptop must be on the **same WiFi** — not mobile data
- Open IP Webcam on phone and tap **Start server** BEFORE running the script
- Run the script only **once** — don't run it again while it's already running

---

## Scorekeeper PIN

`1234`

---

## Go live on YouTube

1. Get stream key from [studio.youtube.com](https://studio.youtube.com) → Go Live → Stream
2. Open dashboard → Broadcast panel → select YouTube
3. Paste stream key → click **Go Live on YouTube**
