#!/bin/bash
# ─────────────────────────────────────────────────────────────
# VollyCast — One command startup
# Usage: ./scripts/start.sh
# ─────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="/home/muhammad/Documents/volly-ball"
cd "$PROJECT_DIR"

# ── Colors ────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
ask()     { echo -e "${YELLOW}[?]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        VollyCast Startup             ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: Get laptop IP ─────────────────────────────────────
LAPTOP_IP=$(hostname -I | awk '{print $1}')
info "Laptop IP: $LAPTOP_IP"

# ── Step 2: Kill old FFmpeg processes ─────────────────────────
if pgrep -f "ffmpeg.*rtmp://localhost" > /dev/null 2>&1; then
  warn "Stopping old FFmpeg processes..."
  pkill -f "ffmpeg.*rtmp://localhost" 2>/dev/null || true
  sleep 2
fi
info "FFmpeg cleaned up"

# ── Step 3: Start Docker ──────────────────────────────────────
warn "Starting Docker containers..."
docker compose down --remove-orphans > /dev/null 2>&1 || true
docker compose up -d

# Wait for API to be ready
warn "Waiting for API to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done
info "API is ready"

echo ""
echo "─────────────────────────────────────────"

# ── Step 4: Ask how many cameras ─────────────────────────────
ask "How many cameras are you connecting? (1-6):"
read -r CAM_COUNT
if ! [[ "$CAM_COUNT" =~ ^[1-6]$ ]]; then
  CAM_COUNT=1
  warn "Invalid input — using 1 camera"
fi

# ── Step 5: Connect each camera ──────────────────────────────
declare -a FFMPEG_PIDS=()

for i in $(seq 1 "$CAM_COUNT"); do
  echo ""
  echo "─── Camera $i ────────────────────────────"
  ask "Enter IP Webcam URL for camera $i (shown in IP Webcam app, e.g. 192.168.0.196):"
  read -r PHONE_IP

  # Clean up input — remove http:// and port if user typed full URL
  PHONE_IP=$(echo "$PHONE_IP" | sed 's|http://||' | sed 's|:8080||' | tr -d ' ')

  # Test connection
  warn "Testing connection to $PHONE_IP:8080..."
  if ! curl -s --max-time 3 "http://$PHONE_IP:8080/video" -I > /dev/null 2>&1; then
    error "Cannot reach IP Webcam at $PHONE_IP:8080. Make sure:\n  - Phone is on same WiFi\n  - IP Webcam app is running\n  - Server is started in the app"
  fi
  info "Phone camera reachable"

  # Start FFmpeg in background
  CAM_NAME="cam$i"
  warn "Starting FFmpeg for $CAM_NAME..."
  ffmpeg -i "http://$PHONE_IP:8080/video" \
    -vcodec libx264 -preset ultrafast -tune zerolatency \
    -f flv "rtmp://localhost:1935/live/$CAM_NAME" \
    > "/tmp/ffmpeg_${CAM_NAME}.log" 2>&1 &
  FFMPEG_PIDS+=($!)
  info "FFmpeg started for $CAM_NAME (PID: ${FFMPEG_PIDS[-1]})"
done

# ── Step 6: Wait for HLS files ───────────────────────────────
echo ""
warn "Waiting for streams to appear in nginx..."
for i in $(seq 1 "$CAM_COUNT"); do
  CAM_NAME="cam$i"
  for attempt in $(seq 1 20); do
    if docker exec vollycast-nginx-rtmp ls /tmp/hls/ 2>/dev/null | grep -q "${CAM_NAME}.m3u8"; then
      info "$CAM_NAME stream is live"
      break
    fi
    if [ "$attempt" -eq 20 ]; then
      warn "$CAM_NAME stream not detected — check FFmpeg log: cat /tmp/ffmpeg_${CAM_NAME}.log"
    fi
    sleep 1
  done
done

# ── Step 7: Register cameras ──────────────────────────────────
echo ""
warn "Registering cameras with VollyCast..."
for i in $(seq 1 "$CAM_COUNT"); do
  CAM_NAME="cam$i"
  # Remove existing camera with same name to prevent duplicates
  curl -s -X POST http://localhost:4000/cameras/disconnect \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$CAM_NAME\"}" > /dev/null 2>&1 || true

  RESULT=$(curl -s -X POST http://localhost:4000/cameras/connect \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$CAM_NAME\",\"streamUrl\":\"rtmp://nginx-rtmp:1935/live/$CAM_NAME\"}")

  if echo "$RESULT" | grep -q '"status"'; then
    info "$CAM_NAME registered"
  else
    warn "$CAM_NAME registration failed: $RESULT"
  fi
done

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              VollyCast is READY                  ║"
echo "╠══════════════════════════════════════════════════╣"
printf "║  Director Dashboard : http://%-20s║\n" "$LAPTOP_IP:3000"
printf "║  Scorekeeper App    : http://%-20s║\n" "$LAPTOP_IP:3002"
printf "║  Scoreboard Overlay : http://%-20s║\n" "$LAPTOP_IP:3001"
printf "║  Watch in VLC       : http://%-20s║\n" "$LAPTOP_IP:8080/hls/cam1.m3u8"
echo "╚══════════════════════════════════════════════════╝"
echo ""
info "Press Ctrl+C to stop everything"

# ── Cleanup on exit ───────────────────────────────────────────
cleanup() {
  echo ""
  warn "Stopping VollyCast..."
  for PID in "${FFMPEG_PIDS[@]}"; do
    kill "$PID" 2>/dev/null || true
  done
  docker compose down
  info "VollyCast stopped"
  exit 0
}
trap cleanup INT TERM

# Keep running
wait
