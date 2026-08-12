#!/bin/bash
# start-camera.sh
# Usage: ./scripts/start-camera.sh <phone-ip> <cam-name>
# Example: ./scripts/start-camera.sh 10.177.87.79 cam1

PHONE_IP=${1:-"10.177.87.79"}
CAM_NAME=${2:-"cam1"}
API_URL="http://localhost:4000"

echo "==> Connecting DroidCam from $PHONE_IP..."
droidcam-cli "$PHONE_IP" 4747 &
DROIDCAM_PID=$!
sleep 3

# Find the video device DroidCam created
VIDEO_DEV=$(ls /dev/video* 2>/dev/null | tail -1)
echo "==> Video device: $VIDEO_DEV"

echo "==> Waiting for Docker to be ready..."
until curl -s "$API_URL/health" > /dev/null 2>&1; do
  sleep 1
done

echo "==> Pushing $CAM_NAME to nginx via FFmpeg..."
ffmpeg -f v4l2 -i "$VIDEO_DEV" \
  -vcodec libx264 -preset ultrafast -tune zerolatency \
  -f flv "rtmp://localhost:1935/live/$CAM_NAME" &
FFMPEG_PID=$!
sleep 4

echo "==> Waiting for HLS stream to appear..."
until docker exec vollycast-nginx-rtmp ls /tmp/hls/ 2>/dev/null | grep -q "${CAM_NAME}.m3u8"; do
  sleep 1
  echo "   waiting..."
done

echo "==> Registering $CAM_NAME with VollyCast API..."
curl -s -X POST "$API_URL/cameras/connect" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$CAM_NAME\",\"streamUrl\":\"rtmp://nginx-rtmp:1935/live/$CAM_NAME\"}"

echo ""
echo "==> Done! Camera $CAM_NAME is live."
echo "    Watch at: http://$(hostname -I | awk '{print $1}'):8080/hls/${CAM_NAME}.m3u8"
echo "    Dashboard: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "    Press Ctrl+C to stop."

# Keep running — cleanup on exit
trap "kill $FFMPEG_PID $DROIDCAM_PID 2>/dev/null; exit" INT TERM
wait $FFMPEG_PID
