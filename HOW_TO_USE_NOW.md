# How to Use VollyCast Right Now

Your laptop IP on this network: **10.248.125.23**
(Run `hostname -I | awk '{print $1}'` to check it again if your WiFi/hotspot changes)

---

## What you need

| Item | What it is |
|---|---|
| Your laptop | Runs VollyCast |
| 1-2 Android phones | Cameras — must be on the same WiFi/hotspot |
| Streamlabs app | To stream from the phone to the laptop |
| YouTube account | To go live on YouTube (optional) |

---

## Step 1 — Start VollyCast on your laptop

Open a terminal and run:

```bash
cd /home/muhammad/Documents/volly-ball
docker compose up -d
```

Verify both containers are running:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

You should see:
```
vollycast-api          Up ...   0.0.0.0:3001->3001/tcp, 0.0.0.0:4000->4000/tcp
vollycast-nginx-rtmp   Up ...   0.0.0.0:1935->1935/tcp, 0.0.0.0:8080->8080/tcp
```

---

## Step 2 — Connect a phone as a camera

Open **Streamlabs** on the phone.

Go to **Settings → Stream → Custom RTMP** and fill in:

| Field | Value |
|---|---|
| **Server URL** | `rtmp://10.248.125.23:1935/live` |
| **Stream Key** | `cam1` |

For a second phone use stream key `cam2`.

Tap **Go Live**. The phone is now streaming to your laptop.

---

## Step 3 — Register the camera with the API

After tapping Go Live, run this on your laptop:

```bash
# Camera 1
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam1","streamUrl":"rtmp://nginx-rtmp:1935/live/cam1"}'

# Camera 2 (if using a second phone)
curl -X POST http://localhost:4000/cameras/connect \
  -H "Content-Type: application/json" \
  -d '{"name":"cam2","streamUrl":"rtmp://nginx-rtmp:1935/live/cam2"}'
```

Verify cameras are connected:
```bash
curl http://localhost:4000/cameras
```

---

## Step 4 — Watch the live stream

Open **VLC Media Player** → Media → Open Network Stream:

```
http://10.248.125.23:8080/hls/cam1.m3u8
```

You will see the live video from the phone within 2-4 seconds.

For camera 2:
```
http://10.248.125.23:8080/hls/cam2.m3u8
```

---

## Step 5 — Open the scoreboard overlay

Open your browser and go to:
```
http://localhost:3001
```

This is the live scoreboard. It updates in real time with no page refresh.

---

## Step 6 — Create a match and start scoring

**Create a match:**
```bash
curl -X POST http://localhost:3001/api/match \
  -H "Content-Type: application/json" \
  -d '{"homeTeam":{"name":"DG Khan A","color":"#FF0000"},"awayTeam":{"name":"DG Khan B","color":"#0000FF"}}'
```

Copy the `id` from the response. Then score points:
```bash
# Home team scores
curl -X POST http://localhost:3001/api/score/home/increment \
  -H "Content-Type: application/json" \
  -d '{"matchId":"PASTE_ID_HERE"}'

# Away team scores
curl -X POST http://localhost:3001/api/score/away/increment \
  -H "Content-Type: application/json" \
  -d '{"matchId":"PASTE_ID_HERE"}'

# Undo a point
curl -X POST http://localhost:3001/api/score/home/decrement \
  -H "Content-Type: application/json" \
  -d '{"matchId":"PASTE_ID_HERE"}'
```

The scoreboard at `http://localhost:3001` updates instantly every time.

---

## Step 7 — Add the scoreboard to OBS

1. Open OBS
2. In Sources, click **+** → **Browser**
3. Set URL to: `http://localhost:3001`
4. Set Width: `1920`, Height: `1080`
5. Check **Shutdown source when not visible**
6. Click OK

The scoreboard will appear as a transparent overlay on your stream in OBS.

---

## Step 8 — Go live on YouTube (optional)

### First time only — get your YouTube stream key

1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click **Go Live** (top right)
3. Choose **Stream**
4. Copy your **Stream key**

### Start the broadcast

```bash
curl -X POST http://localhost:4000/broadcast/start \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "streamKey": "YOUR_YOUTUBE_STREAM_KEY",
    "inputUrl": "rtmp://nginx-rtmp:1935/live/cam1"
  }'
```

### Check broadcast status

```bash
curl http://localhost:4000/broadcast/status
```

Response when live:
```json
{"status":"live","platform":"youtube","isLive":true}
```

### Stop the broadcast

```bash
curl -X POST http://localhost:4000/broadcast/stop
```

### Go live on Facebook instead

```bash
curl -X POST http://localhost:4000/broadcast/start \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "facebook",
    "streamKey": "YOUR_FACEBOOK_STREAM_KEY",
    "inputUrl": "rtmp://nginx-rtmp:1935/live/cam1"
  }'
```

---

## Step 9 — Stop everything

```bash
docker compose down
```

---

## Quick reference — all URLs

| What | URL |
|---|---|
| API health | http://localhost:4000/health |
| Camera list | http://localhost:4000/cameras |
| Broadcast status | http://localhost:4000/broadcast/status |
| Scoreboard overlay | http://localhost:3001 |
| Watch cam1 in VLC | http://10.248.125.23:8080/hls/cam1.m3u8 |
| Watch cam2 in VLC | http://10.248.125.23:8080/hls/cam2.m3u8 |

---

## Match day checklist

```
[ ] docker compose up -d
[ ] Phone connected to same WiFi/hotspot as laptop
[ ] Streamlabs configured with rtmp://10.248.125.23:1935/live and key cam1
[ ] Tap Go Live on phone
[ ] curl /cameras/connect to register camera
[ ] VLC confirms stream is visible
[ ] Open http://localhost:3001 for scoreboard
[ ] OBS browser source added (if using OBS)
[ ] curl /broadcast/start with YouTube key (if going live)
[ ] curl /api/match to create match
[ ] Score updates via curl commands during match
[ ] curl /broadcast/stop after match ends
[ ] docker compose down to shut everything down
```

---

## Troubleshooting

**Phone can't connect to RTMP (connection refused)**
- Check Docker is running: `docker ps`
- Check the IP: `hostname -I | awk '{print $1}'`
- Phone must be on the same WiFi/hotspot as laptop — not mobile data

**VLC shows "cannot open MRL"**
- The phone is not streaming yet — tap Go Live first, then open VLC
- HLS file only exists while the phone is actively streaming

**Scoreboard not updating**
- Create a match first with the curl command
- Use the correct matchId in score commands

**Broadcast auto-reconnects but eventually stops**
- Normal behaviour — reconnects up to 5 times with exponential backoff
- If it keeps failing, check your YouTube stream key is correct
- Check your internet connection from the laptop

**Docker says port already in use**
- Something else is using port 1935, 4000, or 3001
- Run: `docker compose down` then `docker compose up -d`
- Or kill the process: `lsof -ti:1935 | xargs kill -9`
