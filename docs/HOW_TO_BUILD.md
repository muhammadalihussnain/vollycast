# How to Build VollyCast

This guide explains how to build the project from source — for development, for running locally, and for producing production Docker images.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and Install](#2-clone-and-install)
3. [Build Order](#3-build-order)
4. [Build Individual Packages](#4-build-individual-packages)
5. [Build All Packages](#5-build-all-packages)
6. [Run Tests](#6-run-tests)
7. [Run Linter and Type Checker](#7-run-linter-and-type-checker)
8. [Build Docker Images](#8-build-docker-images)
9. [Run the Full Stack Locally](#9-run-the-full-stack-locally)
10. [Development Mode (without Docker)](#10-development-mode-without-docker)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20 LTS | `node --version` |
| pnpm | 9.x | `pnpm --version` |
| Docker + Compose | 24+ | `docker --version` |
| FFmpeg | 4.4+ | `ffmpeg -version` |

Install pnpm if missing:
```bash
npm install -g pnpm@9.1.0
```

---

## 2. Clone and Install

```bash
git clone https://github.com/muhammadalihussnain/vollycast.git
cd vollycast
pnpm install
```

This installs dependencies for all 9 packages in the monorepo at once.

---

## 3. Build Order

Packages must be built in dependency order because TypeScript uses the compiled `.d.ts` files from `dist/` for type resolution:

```
1. shared                  ← everything depends on this
2. camera-ingestion
3. stream-engine           ← broadcast-manager depends on this
4. scoreboard-overlay
5. recording-manager
6. broadcast-manager       ← depends on stream-engine
7. scene-switcher
8. api-server              ← depends on all of the above
9. web-dashboard           ← standalone React app
10. mobile-controller      ← standalone React PWA
```

---

## 4. Build Individual Packages

```bash
# Build shared layer
pnpm --filter @vollycast/shared build

# Build a specific package
pnpm --filter @vollycast/stream-engine build

# Build the API server
pnpm --filter @vollycast/api-server build
```

---

## 5. Build All Packages

```bash
# Build every package in the correct order
pnpm --filter @vollycast/shared build
pnpm --filter @vollycast/camera-ingestion build
pnpm --filter @vollycast/stream-engine build
pnpm --filter @vollycast/scoreboard-overlay build
pnpm --filter @vollycast/recording-manager build
pnpm --filter @vollycast/broadcast-manager build
pnpm --filter @vollycast/scene-switcher build
pnpm --filter @vollycast/api-server build
pnpm --filter @vollycast/web-dashboard build
pnpm --filter @vollycast/mobile-controller build
```

---

## 6. Run Tests

```bash
# Run tests for all packages
pnpm -r run test

# Run tests for a specific package
cd packages/scene-switcher
npx vitest run

# Run tests with coverage
cd packages/broadcast-manager
pnpm coverage
```

Expected output: all test files pass, coverage >= 90%.

---

## 7. Run Linter and Type Checker

```bash
# Lint all TypeScript files
pnpm lint

# Type check all packages
pnpm -r run typecheck
```

Both must exit with code 0 before submitting a PR.

---

## 8. Build Docker Images

Build all Docker images:
```bash
docker compose build
```

Build a specific image:
```bash
docker compose build vollycast-api
docker compose build web-dashboard
docker compose build mobile-controller
```

---

## 9. Run the Full Stack Locally

```bash
# Start all services in the background
docker compose up -d

# Check all containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# View logs from the API server
docker logs -f vollycast-api

# Stop everything
docker compose down
```

Services started:
| Service | URL | Purpose |
|---|---|---|
| nginx-rtmp | `rtmp://localhost:1935/live` | Receives phone camera streams |
| vollycast-api | `http://localhost:4000` | REST API |
| scoreboard overlay | `http://localhost:3001` | OBS browser source |
| web-dashboard | `http://localhost:3000` | Director control panel |
| mobile-controller | `http://localhost:3002` | Scorekeeper PWA |

---

## 10. Development Mode (without Docker)

For faster iteration, run the backend and frontend separately without Docker.

**Terminal 1 — Build and start the API:**
```bash
# Build all backend packages first
pnpm --filter @vollycast/shared build
pnpm --filter @vollycast/camera-ingestion build
pnpm --filter @vollycast/stream-engine build
pnpm --filter @vollycast/scoreboard-overlay build
pnpm --filter @vollycast/recording-manager build
pnpm --filter @vollycast/broadcast-manager build
pnpm --filter @vollycast/scene-switcher build
pnpm --filter @vollycast/api-server build

node packages/api-server/dist/server.js
```

**Terminal 2 — Web Dashboard (hot reload):**
```bash
cd packages/web-dashboard
pnpm dev
# Opens on http://localhost:3000
```

**Terminal 3 — Mobile Controller (hot reload):**
```bash
cd packages/mobile-controller
pnpm dev
# Opens on http://localhost:3002
```

**Terminal 4 — nginx RTMP (still needs Docker):**
```bash
docker compose up nginx-rtmp -d
```

---

## 11. Troubleshooting

**`Cannot find module '@vollycast/shared'`**
You need to build the shared package first:
```bash
pnpm --filter @vollycast/shared build
```

**`pnpm install` fails with lockfile error**
```bash
pnpm install --no-frozen-lockfile
```

**Port already in use**
```bash
# Find and kill the process using a port
lsof -ti:4000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

**Docker build fails on `pnpm install`**
The Dockerfiles use `--ignore-scripts` to skip husky. If you see a different error, run:
```bash
docker compose build --no-cache
```

**FFmpeg not found**
```bash
sudo apt update && sudo apt install ffmpeg
```
