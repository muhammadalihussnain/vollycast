# How to Deploy VollyCast

This guide covers two deployment scenarios:

1. **Local LAN deployment** — run on a laptop, stream to phones on the same WiFi (current setup)
2. **Cloud/VPS deployment** — run on a remote server, stream live to YouTube/Facebook

---

## Table of Contents

1. [Local LAN Deployment (current)](#1-local-lan-deployment-current)
2. [Environment Variables](#2-environment-variables)
3. [Cloud VPS Deployment](#3-cloud-vps-deployment)
4. [SSL with Let's Encrypt](#4-ssl-with-lets-encrypt)
5. [Process Management with PM2](#5-process-management-with-pm2)
6. [Database Migration (SQLite to PostgreSQL)](#6-database-migration-sqlite-to-postgresql)
7. [Monitoring and Logs](#7-monitoring-and-logs)
8. [Backup Strategy](#8-backup-strategy)

---

## 1. Local LAN Deployment (current)

This is the setup you are running today — laptop on a hotspot with phone cameras.

### Requirements
- Dell Latitude 5420 (or similar)
- Docker installed
- Phones on the same WiFi/hotspot

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/muhammadalihussnain/vollycast.git
cd vollycast

# 2. Get your laptop IP
hostname -I | awk '{print $1}'
# Example output: 10.248.125.23

# 3. Start everything
docker compose up -d

# 4. Verify all containers are up
docker ps
```

### Access points after startup

| What | URL | Used by |
|---|---|---|
| Director dashboard | `http://10.248.125.23:3000` | Director's laptop/tablet |
| Scorekeeper app | `http://10.248.125.23:3002` | Scorekeeper's phone |
| Scoreboard overlay | `http://10.248.125.23:3001` | OBS browser source |
| API | `http://10.248.125.23:4000` | Internal |
| HLS streams | `http://10.248.125.23:8080/hls/cam1.m3u8` | VLC / OBS |

### Connect phone cameras

In Streamlabs on each phone:
- Server URL: `rtmp://10.248.125.23:1935/live`
- Stream Key: `cam1` (second phone: `cam2`, etc.)

### Update the IP in HOW_TO_USE_NOW.md if it changes

```bash
hostname -I | awk '{print $1}'
```

---

## 2. Environment Variables

Create a `.env` file in the project root (never commit it):

```bash
cp .env.example .env
```

Edit `.env`:

```env
# API server
API_PORT=4000
OVERLAY_PORT=3001
RTMP_HOST=nginx-rtmp
RTMP_PORT=1935
RECORDINGS_PATH=/recordings

# Stream key encryption (REQUIRED for broadcast manager)
# Generate once with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
STREAM_KEY_SECRET=your_64_char_hex_string_here

# Node environment
NODE_ENV=production
```

To use the `.env` file with Docker Compose, add to `docker-compose.yml`:
```yaml
vollycast-api:
  env_file:
    - .env
```

---

## 3. Cloud VPS Deployment

For streaming live to YouTube from a server rather than a laptop.

### Minimum VPS specs
- 4 vCPU, 8 GB RAM
- 50 GB SSD (for recordings)
- Ubuntu 22.04 LTS
- 100 Mbps network

### Step 1 — Provision the server

```bash
# SSH into your VPS
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Install FFmpeg
apt install ffmpeg -y
```

### Step 2 — Clone and configure

```bash
git clone https://github.com/muhammadalihussnain/vollycast.git
cd vollycast

# Create and fill .env
cp .env.example .env
nano .env
# Fill in STREAM_KEY_SECRET and any other values
```

### Step 3 — Start the stack

```bash
docker compose up -d
docker ps  # verify all containers are running
```

### Step 4 — Open firewall ports

```bash
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw allow 1935    # RTMP (camera input)
ufw allow 3000    # Web dashboard
ufw allow 3001    # Scoreboard overlay
ufw allow 3002    # Mobile controller
ufw allow 4000    # API
ufw allow 8080    # HLS
ufw enable
```

---

## 4. SSL with Let's Encrypt

For HTTPS access to the dashboard and overlay from outside your network.

```bash
# Install certbot
apt install certbot python3-certbot-nginx -y

# Get certificate (replace with your domain)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renew
certbot renew --dry-run
```

Then update `infrastructure/nginx/dashboard.conf` to use port 443 with SSL.

---

## 5. Process Management with PM2

If running without Docker on a VPS:

```bash
# Install PM2
npm install -g pm2

# Build all packages first
pnpm -r run build

# Start the API server
pm2 start packages/api-server/dist/server.js --name vollycast-api

# Save and set to auto-start on reboot
pm2 save
pm2 startup
```

---

## 6. Database Migration (SQLite to PostgreSQL)

The current stack is stateless (no database). When you add a database in a future phase:

```bash
# Install PostgreSQL
apt install postgresql -y

# Add to docker-compose.yml:
# db:
#   image: postgres:16-alpine
#   environment:
#     POSTGRES_DB: vollycast
#     POSTGRES_USER: vollycast
#     POSTGRES_PASSWORD: changeme
```

---

## 7. Monitoring and Logs

```bash
# View live logs from all containers
docker compose logs -f

# View logs from a specific container
docker logs -f vollycast-api
docker logs -f vollycast-nginx-rtmp

# Check resource usage
docker stats
```

---

## 8. Backup Strategy

### Recordings backup

```bash
# Recordings are stored in the recordings-data Docker volume
# Back it up to an external drive or S3:
docker run --rm \
  -v volly-ball_recordings-data:/data \
  -v /your/backup/path:/backup \
  alpine tar czf /backup/recordings-$(date +%Y%m%d).tar.gz /data
```

### Configuration backup

```bash
# Back up your .env file and nginx configs
cp .env /path/to/backup/
cp -r infrastructure/ /path/to/backup/
```

---

## Quick reference — ports

| Port | Protocol | Purpose |
|---|---|---|
| 1935 | TCP | RTMP — phone cameras stream to this |
| 3000 | HTTP | Web dashboard (director) |
| 3001 | HTTP/WS | Scoreboard overlay (OBS browser source) |
| 3002 | HTTP | Mobile controller (scorekeeper) |
| 4000 | HTTP | REST API |
| 8080 | HTTP | HLS video streams |
