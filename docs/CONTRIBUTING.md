# Contributing to VollyCast

Thank you for your interest in contributing. This document explains how the project is organized, how to set up your development environment, and the standards every contribution must meet.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites](#2-prerequisites)
3. [Getting Started](#3-getting-started)
4. [Branch Strategy](#4-branch-strategy)
5. [Commit Message Convention](#5-commit-message-convention)
6. [Coding Standards](#6-coding-standards)
7. [Testing Requirements](#7-testing-requirements)
8. [Pull Request Process](#8-pull-request-process)
9. [Module Ownership](#9-module-ownership)

---

## 1. Project Overview

VollyCast is a monorepo built with **pnpm workspaces**. Each module is a separate package under `packages/`. All modules communicate through the shared **EventBus** — no module imports directly from another module except through the shared layer.

```
vollycast/
├── packages/
│   ├── camera-ingestion/      Module 1
│   ├── stream-engine/         Module 2
│   ├── scoreboard-overlay/    Module 3
│   ├── broadcast-manager/     Module 4
│   ├── scene-switcher/        Module 5
│   ├── recording-manager/     Module 6
│   ├── web-dashboard/         Module 7
│   ├── mobile-controller/     Module 8
│   └── api-server/            Combined entry point
├── shared/                    Types, constants, EventBus
└── infrastructure/            Docker, nginx configs
```

---

## 2. Prerequisites

| Tool | Version | How to install |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm@9.1.0` |
| Docker | 24+ | https://docs.docker.com/get-docker |
| FFmpeg | 4.4+ | `sudo apt install ffmpeg` |
| Git | 2.x | `sudo apt install git` |

---

## 3. Getting Started

```bash
git clone https://github.com/muhammadalihussnain/vollycast.git
cd vollycast
pnpm install
pnpm --filter @vollycast/shared build
pnpm -r run build
pnpm -r run test
pnpm lint
```

---

## 4. Branch Strategy

```
main       → production-ready, protected, never push directly
develop    → integration branch, all features merge here
feature/*  → one branch per feature
fix/*      → bug fixes
test/*     → adding or fixing tests
chore/*    → dependency updates, config changes
```

Always branch from `develop`:
```bash
git checkout develop && git pull
git checkout -b feature/your-feature-name
```

---

## 5. Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scoreboard): add animated score transition
fix(stream-engine): resolve FFmpeg process leak
test(camera-ingestion): add timeout recovery tests
chore(deps): upgrade socket.io to 4.8.1
docs(contributing): add setup instructions
```

Allowed types: `feat`, `fix`, `test`, `chore`, `docs`, `refactor`, `perf`, `ci`

---

## 6. Coding Standards

**TypeScript**
- Strict mode always on — no `any`, all types explicit
- `const` by default, `let` only when mutation needed
- `readonly` on all properties that should not change

**No magic numbers** — all constants in `shared/src/constants/index.ts`:
```ts
// Wrong
if (usedPercent >= 85) { ... }
// Correct
if (usedPercent >= RECORDING.DISK_WARNING_THRESHOLD_PERCENT) { ... }
```

**No console.log** — use the structured logger:
```ts
import { logger } from './logger.js';
logger.info({ cameraId }, 'Camera connected');
```

**No direct module imports** — use EventBus:
```ts
// Wrong
import { SceneSwitcher } from '@vollycast/scene-switcher';
// Correct
bus.on(VOLLYCAST_EVENTS.SCENE_SWITCHED, handler);
```

**Clean up subscriptions** on shutdown:
```ts
const unsub = bus.on(VOLLYCAST_EVENTS.CAMERA_CONNECTED, handler);
// on stop():
unsub();
```

---

## 7. Testing Requirements

- Lines, functions, statements: **≥ 90%**
- Branches: **≥ 85%** (race-condition guards may use `/* c8 ignore */`)
- All external dependencies mocked (FFmpeg, network, file system)
- Tests must complete in under 30 seconds

```bash
# Coverage for one package
cd packages/recording-manager && pnpm coverage

# All tests
pnpm -r run test
```

---

## 8. Pull Request Process

1. All CI checks must pass (build, typecheck, lint, tests, coverage, audit)
2. Fill in the PR template checklist
3. Base branch must be `develop` — never `main`
4. Request at least one review
5. Squash and merge after approval

CI pipeline runs:
1. `pnpm -r run build`
2. `pnpm -r run typecheck`
3. `pnpm lint`
4. `pnpm -r run coverage`
5. `pnpm audit --audit-level=high --prod`

---

## 9. Module Ownership

| Module | Package | Key files |
|---|---|---|
| Shared | `shared/` | `constants/index.ts`, `types/index.ts`, `events/EventBus.ts` |
| Camera Ingestion | `camera-ingestion/` | `CameraIngestionService.ts`, `CameraRegistry.ts` |
| Stream Engine | `stream-engine/` | `StreamEngine.ts`, `FfmpegProcess.ts`, `QualityStrategy.ts` |
| Scoreboard Overlay | `scoreboard-overlay/` | `MatchService.ts`, `OverlaySocket.ts`, `scoreRouter.ts` |
| Broadcast Manager | `broadcast-manager/` | `BroadcastManager.ts`, `StreamKeyStore.ts` |
| Scene Switcher | `scene-switcher/` | `SceneSwitcher.ts`, `SceneRegistry.ts` |
| Recording Manager | `recording-manager/` | `RecordingManager.ts`, `RecordingSession.ts`, `DiskMonitor.ts` |
| Web Dashboard | `web-dashboard/` | `App.tsx`, `components/`, `hooks/` |
| Mobile Controller | `mobile-controller/` | `ScoreController.tsx`, `PinGate.tsx`, `useOfflineQueue.ts` |
| API Server | `api-server/` | `server.ts` |
