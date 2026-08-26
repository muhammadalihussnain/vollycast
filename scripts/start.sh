#!/bin/bash
# ─────────────────────────────────────────────────────────────
# VollyCast — One command startup
#
# Usage:
#   ./scripts/start.sh              → reads cameras.json automatically
#   ./scripts/start.sh --manual     → asks for IPs manually
#
# cameras.json format:
#   [
#     { "name": "cam1", "ip": "192.168.0.196" },
#     { "name": "cam2", "ip": "192.168.0.202" }
#   ]
# ─────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAMERAS_FILE="$PROJECT_DIR/cameras.json"
cd "$PROJECT_DIR"

# ── Colors ────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
ask()   { echo -e "${CYAN}[?]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        VollyCast Startup             ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: Get laptop IP ─────────────────────────────────────
LAPTOP_IP=$(hostname -I | awk '{print $1}')
info "Laptop IP: $LAPTOP_IP"

# ── Step 2: Kill old FFmpeg ───────────────────────────────────
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

# ── Step 4: Load cameras ──────────────────────────────────────
declare -a CAM_NAMES=()
declare -a CAM_IPS=()

MANUAL_MODE=false
if [ "$1" == "--manual" ]; then
  MANUAL_MODE=true
fi

if [ "$MANUAL_MODE" = false ] && [ -f "$CAMERAS_FILE" ]; then
  # Read from cameras.json
  info "Reading cameras from cameras.json..."

  # Parse JSON with python3 (available on Ubuntu)
  while IFS='|' read -r name ip; do
    if [ -n "$name" ] && [ -n "$ip" ]; then
      CAM_NAMES+=("$name")
      CAM_IPS+=("$ip")
    fi
  done < <(python3 -c "
import json, sys
with open('$CAMERAS_FILE') as f:
    cams = json.load(f)
for c in cams:
    print(c['name'] + '|' + c['ip'])
")

  echo ""
  echo "  Cameras loaded from cameras.json:"
  for i in "${!CAM_NAMES[@]}"; do
    echo "    ${CAM_NAMES[$i]} → ${CAM_IPS[$i]}"
  done
  echo ""
  ask "Press Enter to continue or Ctrl+C to cancel..."
  read -r

else
  # Manual mode — ask for each camera
  ask "How many cameras? (1-6):"
  read -r CAM_COUNT
  if ! [[ "$CAM_COUNT" =~ ^[1-6]$ ]]; then
    CAM_COUNT=1
  fi

  for i in $(seq 1 "$CAM_COUNT"); do
    echo ""
    echo "─── Camera $i ────────────────────────────"
    ask "IP address for camera $i (from IP Webcam app, e.g. 192.168.0.196):"
    read -r PHONE_IP
    PHONE_IP=$(echo "$PHONE_IP" | sed 's|http://||' | sed 's|:8080||' | tr -d ' ')
    CAM_NAMES+=("cam$i")
    CAM_IPS+=("$PHONE_IP")
  done
fi

# ── Step 5: Test and start each camera ───────────────────────
declare -a FFMPEG_PIDS=()

for i in "${!CAM_NAMES[@]}"; do
  CAM_NAME="${CAM_NAMES[$i]}"
  PHONE_IP="${CAM_IPS[$i]}"

  echo ""
  echo "─── $CAM_NAME ($PHONE_IP) ────────────────"

  # Test connection
  warn "Testing connection to $PHONE_IP:8080..."
  if ! curl -s --max-time 3 "http://$PHONE_IP:8080/video" -I > /dev/null 2>&1; then
    err "Cannot reach $CAM_NAME at $PHONE_IP:8080 — skipping"
    err "Make sure IP Webcam is running on the phone"
    continue
  fi
  info "Connected to $CAM_NAME"

  # Start FFmpeg
  ffmpeg -i "http://$PHONE_IP:8080/video" \
    -vcodec libx264 -preset ultrafast -tune zerolatency \
    -x264-params "keyint=15:min-keyint=15" \
    -f flv "rtmp://localhost:1935/live/$CAM_NAME" \
    > "/tmp/ffmpeg_${CAM_NAME}.log" 2>&1 &
  FFMPEG_PIDS+=($!)
  info "FFmpeg started for $CAM_NAME (PID: ${FFMPEG_PIDS[-1]})"
done

# ── Step 6: Wait for HLS files ───────────────────────────────
echo ""
warn "Waiting for streams to appear..."
ALL_READY=true
for i in "${!CAM_NAMES[@]}"; do
  CAM_NAME="${CAM_NAMES[$i]}"
  READY=false
  for attempt in $(seq 1 15); do
    if docker exec vollycast-nginx-rtmp ls /tmp/hls/ 2>/dev/null | grep -q "${CAM_NAME}.m3u8"; then
      info "$CAM_NAME is live"
      READY=true
      break
    fi
    sleep 1
  done
  if [ "$READY" = false ]; then
    err "$CAM_NAME stream not detected — check: cat /tmp/ffmpeg_${CAM_NAME}.log"
    ALL_READY=false
  fi
done

# ── Step 7: Register cameras ──────────────────────────────────
echo ""
warn "Registering cameras..."
for i in "${!CAM_NAMES[@]}"; do
  CAM_NAME="${CAM_NAMES[$i]}"
  # Remove existing to prevent duplicates
  curl -s -X POST http://localhost:4000/cameras/disconnect \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$CAM_NAME\"}" > /dev/null 2>&1 || true
  # Register
  curl -s -X POST http://localhost:4000/cameras/connect \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$CAM_NAME\",\"streamUrl\":\"rtmp://nginx-rtmp:1935/live/$CAM_NAME\"}" > /dev/null
  info "$CAM_NAME registered"
done

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              VollyCast is READY ✓                    ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Dashboard   : http://%-31s║\n" "$LAPTOP_IP:3000"
printf "║  Scorekeeper : http://%-31s║\n" "$LAPTOP_IP:3002"
printf "║  Overlay     : http://%-31s║\n" "$LAPTOP_IP:3001"
echo "╠══════════════════════════════════════════════════════╣"
for i in "${!CAM_NAMES[@]}"; do
  CAM_NAME="${CAM_NAMES[$i]}"
  printf "║  %-10s  : http://%-31s║\n" "$CAM_NAME" "$LAPTOP_IP:8080/hls/${CAM_NAME}.m3u8"
done
echo "╚══════════════════════════════════════════════════════╝"
echo ""
info "Press Ctrl+C to stop everything"

# ── Cleanup on Ctrl+C ─────────────────────────────────────────
cleanup() {
  echo ""
  warn "Stopping VollyCast..."
  for PID in "${FFMPEG_PIDS[@]}"; do
    kill "$PID" 2>/dev/null || true
  done
  docker compose down
  info "VollyCast stopped. Goodbye."
  exit 0
}
trap cleanup INT TERM
wait
