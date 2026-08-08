# VollyCast — Complete Project Plan
## From Scratch to Production

> Multi-camera live streaming platform for local volleyball (DG Khan, Pakistan).
> This plan covers every phase: setup, modules, GitHub workflow, testing, deployment.
> No code in this document. This is the blueprint only.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [GitHub Setup](#4-github-setup)
5. [Repository Structure](#5-repository-structure)
6. [Module Plan](#6-module-plan)
7. [Build Order](#7-build-order)
8. [Testing Strategy](#8-testing-strategy)
9. [Coding Standards](#9-coding-standards)
10. [Security Plan](#10-security-plan)
11. [Performance Plan](#11-performance-plan)
12. [Design Patterns](#12-design-patterns)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [Scalability Roadmap](#14-scalability-roadmap)
15. [How to Build Guide](#15-how-to-build-guide)
16. [How to Use Guide](#16-how-to-use-guide)

---

## 1. Project Vision

Local volleyball in DG Khan is played with 9 players per team (4 front, 4 back, 1 netman).
Currently filmed with a single mobile phone, unprofessional angle, no overlays.

VollyCast will:
- Accept feeds from 2 cameras (experiment) scaling to 8+ cameras
- Stream locally on LAN first, then live on YouTube / Facebook
- Show live score overlay on screen like international broadcasts
- Give a director a control panel to switch camera angles
- Give a scorekeeper a mobile app to update the score from the field
- Record every match automatically
- Eventually: highlights, replays, ball tracking

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        VOLLYCAST PLATFORM                            │
│                                                                      │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────────────────┐  │
│  │  Camera 1  │───▶│             │    │   Web Dashboard          │  │
│  │  (Phone)   │    │   Camera    │    │   (Director Control)     │  │
│  └────────────┘    │  Ingestion  │    └──────────────────────────┘  │
│                    │  Service    │                                   │
│  ┌────────────┐    │  Module 1   │    ┌──────────────────────────┐  │
│  │  Camera 2  │───▶│             │    │   Mobile Controller      │  │
│  │  (Phone)   │    └──────┬──────┘    │   (Scorekeeper Phone)    │  │
│  └────────────┘           │           └──────────────────────────┘  │
│                           ▼                                          │
│                    ┌─────────────┐    ┌──────────────────────────┐  │
│                    │   Stream    │    │   Scoreboard Overlay     │  │
│                    │   Engine   │───▶│   (Browser Source in OBS)│  │
│                    │  Module 2   │    └──────────────────────────┘  │
│                    └──────┬──────┘                                   │
│                           │                                          │
│              ┌────────────┼────────────┐                            │
│              ▼            ▼            ▼                            │
│       ┌────────────┐ ┌─────────┐ ┌──────────┐                      │
│       │  Scene     │ │Recording│ │Broadcast │                       │
│       │  Switcher  │ │ Manager │ │ Manager  │                       │
│       │  Module 5  │ │Module 6 │ │ Module 4 │                       │
│       └────────────┘ └─────────┘ └────┬─────┘                      │
│                                        │                             │
│                              ┌─────────▼──────────┐                 │
│                              │  YouTube / Facebook │                 │
│                              │  Internet Broadcast │                 │
│                              └────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
```

All modules communicate through a central Event Bus.
No module talks directly to another module — only through events.

---

## 3. Technology Stack

### Backend (Server on Laptop)
- Language: TypeScript (strict mode, no any)
- Runtime: Node.js 20 LTS
- API Framework: Express.js
- Real-time: Socket.IO (WebSocket)
- Media Server: nginx with RTMP module
- Media Processing: FFmpeg
- Database: SQLite (local) → PostgreSQL (cloud scale)
- ORM: Prisma
- Logger: Pino (structured JSON logging, no console.log)
- Process Manager: PM2

### Frontend
- Framework: React 18 + TypeScript + Vite
- Styling: TailwindCSS
- Score Overlay: React (rendered as OBS browser source)
- Dashboard: React SPA
- Mobile Controller: React PWA (works on phone browser)

### Testing
- Unit + Integration: Vitest
- End-to-End: Playwright
- Coverage: c8 (minimum 90%)
- Load Testing: k6
- Security Scanning: npm audit + Snyk

### Code Quality
- Linter: ESLint (strict TypeScript rules)
- Formatter: Prettier
- Pre-commit hooks: Husky + lint-staged
- Type checking: tsc --noEmit on every commit

### DevOps
- Version Control: GitHub
- CI/CD: GitHub Actions
- Containers: Docker + Docker Compose
- Monorepo: pnpm workspaces

---

## 4. GitHub Setup

### Step 1 — Create the Repository
- Create a new GitHub repository named `vollycast`
- Set visibility: Public or Private (your choice)
- Do NOT initialize with README (we push our own)
- Add a .gitignore for Node.js

### Step 2 — Branch Strategy

```
main         → always production-ready, protected
develop      → integration branch, all features merge here first
feature/*    → one branch per feature or module task
fix/*        → bug fixes
test/*       → adding or fixing tests
chore/*      → dependency updates, config changes
```

Rules:
- Never push directly to `main` or `develop`
- Every change goes through a Pull Request
- `main` can only be merged from `develop` after full testing

### Step 3 — Branch Protection Rules (set in GitHub Settings)
- `main` branch:
  - Require pull request before merging
  - Require at least 1 approval
  - Require all CI checks to pass
  - No force push allowed
  - No deletion allowed
- `develop` branch:
  - Require pull request before merging
  - Require all CI checks to pass

### Step 4 — Commit Message Convention (Conventional Commits)

Every commit must follow this format:
```
type(scope): short description

Examples:
feat(scoreboard): add animated score transition
fix(stream-engine): resolve FFmpeg process leak
test(camera-ingestion): add timeout recovery tests
chore(deps): upgrade socket.io to 4.7.2
docs(plan): update module 3 task list
```

Types allowed: feat, fix, test, chore, docs, refactor, perf, ci

### Step 5 — GitHub Actions CI Pipeline

On every Pull Request, the pipeline will automatically:
1. Install dependencies
2. Run TypeScript type check (tsc --noEmit)
3. Run ESLint
4. Run all tests
5. Check coverage is >= 90%
6. Run npm audit for security vulnerabilities
7. If any step fails — PR cannot be merged

### Step 6 — GitHub Issue Templates
- Bug Report template
- Feature Request template
- Module Task template (used when starting each module)

### Step 7 — Pull Request Template
Every PR will have a checklist:
- Tests written and passing
- Coverage >= 90%
- No ESLint errors
- No TypeScript errors
- No magic numbers (all constants in shared/constants)
- No console.log (use logger)
- npm audit passes
- Documentation updated if needed

---

## 5. Repository Structure

```
vollycast/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  ← runs on every PR
│   │   ├── coverage.yml            ← posts coverage report on PR
│   │   └── security.yml            ← npm audit + Snyk scan
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       ├── feature_request.md
│       └── module_task.md
│
├── packages/
│   ├── camera-ingestion/           ← Module 1
│   ├── stream-engine/              ← Module 2
│   ├── scoreboard-overlay/         ← Module 3
│   ├── broadcast-manager/          ← Module 4
│   ├── scene-switcher/             ← Module 5
│   ├── recording-manager/          ← Module 6
│   ├── web-dashboard/              ← Module 7
│   └── mobile-controller/          ← Module 8
│
├── shared/
│   ├── types/                      ← all TypeScript interfaces
│   ├── constants/                  ← all numbers and strings (no magic numbers)
│   └── events/                     ← event bus (shared by all modules)
│
├── infrastructure/
│   ├── nginx/
│   │   └── nginx.conf              ← RTMP server configuration
│   ├── docker/
│   │   ├── Dockerfile.backend
│   │   └── Dockerfile.frontend
│   └── docker-compose.yml          ← run entire system with one command
│
├── docs/
│   ├── HOW_TO_BUILD.md
│   ├── HOW_TO_USE.md
│   ├── API.md                      ← all API endpoints documented
│   └── diagrams/                   ← architecture diagrams
│
├── scripts/
│   ├── setup.sh                    ← one-command dev environment setup
│   ├── test-all.sh                 ← run all module tests
│   └── coverage-report.sh         ← generate full coverage report
│
├── PLAN.md                         ← this file
├── CHANGELOG.md                    ← auto-generated from commits
├── package.json                    ← monorepo root
├── pnpm-workspace.yaml
├── tsconfig.base.json              ← shared TypeScript config
├── .eslintrc.json
├── .prettierrc
├── .env.example                    ← template for environment variables
└── .gitignore
```

Each module package follows this internal structure:
```
packages/module-name/
├── src/
│   ├── index.ts                    ← public API of the module
│   ├── [main service files]
│   └── [sub-components]
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md                       ← module-specific usage docs
```

---

## 6. Module Plan

---

### FOUNDATION — Shared Layer
Not a runnable module. Required before any module can be built.

Tasks:
- Task F1: Create shared/types — all TypeScript interfaces (Camera, Match, Score, Scene, Broadcast, Recording)
- Task F2: Create shared/constants — all numbers and string constants (ports, limits, thresholds, quality profiles)
- Task F3: Create shared/events — Event Bus using Singleton + Observer pattern
- Task F4: Set up monorepo (pnpm workspaces, tsconfig.base.json, ESLint, Prettier, Husky)
- Task F5: Set up GitHub repo, branch protection, CI pipeline, PR template, issue templates

Test: shared layer has 100% type coverage, event bus unit tested, CI pipeline runs green.

---

### MODULE 1 — Camera Ingestion Service

Purpose: Accept video feeds from camera phones and make them available to the stream engine.

Tasks:
- Task 1.1: RTMP listener — accept incoming streams from DroidCam/IP cameras
- Task 1.2: Camera registry — track connected cameras, their status, and stream URLs
- Task 1.3: Camera discovery — detect cameras on local WiFi network
- Task 1.4: Event emission — emit CAMERA_CONNECTED, CAMERA_DISCONNECTED, CAMERA_ERROR events
- Task 1.5: Health monitoring — detect dead streams and emit error events
- Task 1.6: Tests — unit tests for registry, integration tests for connect/disconnect flows
- Task 1.7: README — how to connect a phone as a camera

Test gate: All tasks complete, coverage >= 90%, CI green → move to Module 2.

---

### MODULE 2 — Stream Engine

Purpose: Take raw camera feeds and transcode them into streamable formats (HLS + RTMP).

Tasks:
- Task 2.1: FFmpeg wrapper — start/stop transcoding per camera with proper process lifecycle
- Task 2.2: Quality profiles — implement low/medium/high profiles (Strategy pattern)
- Task 2.3: HLS output — generate HLS playlist and segments for local playback
- Task 2.4: RTMP output — forward transcoded stream to nginx RTMP
- Task 2.5: Process manager — ensure no orphan FFmpeg processes (memory/process leak prevention)
- Task 2.6: Stream health metrics — collect bitrate, dropped frames, latency per stream
- Task 2.7: Tests — unit tests for FFmpeg wrapper, integration tests for pipeline start/stop
- Task 2.8: README — how to configure quality profiles

Test gate: All tasks complete, coverage >= 90%, no process leaks detected, CI green → move to Module 3.

---

### MODULE 3 — Scoreboard Overlay Service

Purpose: Live score display shown on the broadcast as a browser source in OBS.

Tasks:
- Task 3.1: Match service — create match, set team names/colors, manage sets
- Task 3.2: Score service — increment/decrement score, validate score rules
- Task 3.3: REST API — endpoints for score update, match create, match query
- Task 3.4: WebSocket server — push score changes to all connected overlays in real time
- Task 3.5: Overlay UI — React component showing score, team names, set scores (browser source)
- Task 3.6: Score animation — animated effect when score changes
- Task 3.7: Tests — unit tests for score logic, integration tests for API, E2E test for overlay update
- Task 3.8: README — how to add overlay as browser source in OBS

Test gate: Score update must appear on overlay within 200ms. Coverage >= 90%. CI green → move to Module 4.

---

### MODULE 4 — Broadcast Manager

Purpose: Push the final stream to internet platforms (YouTube, Facebook).

Tasks:
- Task 4.1: Platform adapters — YouTube adapter, Facebook adapter (Adapter pattern)
- Task 4.2: Stream key management — encrypt/decrypt stream keys at rest (AES-256)
- Task 4.3: Outbound RTMP push — send stream to platform using FFmpeg
- Task 4.4: Connection monitoring — detect drops and trigger reconnect
- Task 4.5: Auto-reconnect logic — retry with exponential backoff (max 5 attempts)
- Task 4.6: Broadcast status events — emit BROADCAST_STARTED, BROADCAST_STOPPED, BROADCAST_RECONNECTING
- Task 4.7: Tests — unit tests for adapters, integration tests for connect/reconnect
- Task 4.8: README — how to add YouTube/Facebook stream keys

Test gate: Reconnect works under simulated drop. Stream keys never logged in plaintext. Coverage >= 90%. CI green → move to Module 5.

---

### MODULE 5 — Scene Switcher

Purpose: Switch between camera angles live during the broadcast.

Tasks:
- Task 5.1: Scene registry — register available scenes (one per camera)
- Task 5.2: Switch logic — execute camera switch with transition effect (State Machine pattern)
- Task 5.3: Transition types — cut (instant) and fade (smooth)
- Task 5.4: API endpoint — POST /api/scene/switch
- Task 5.5: WebSocket command — allow dashboard to switch scene via WebSocket
- Task 5.6: Thumbnail generator — generate preview thumbnail per camera at 1fps
- Task 5.7: Tests — unit tests for state machine, integration tests for rapid switch handling
- Task 5.8: README — how to use scene switching

Test gate: Scene switch completes within 100ms for cut, within 600ms for fade. No state corruption on rapid switching. Coverage >= 90%. CI green → move to Module 6.

---

### MODULE 6 — Recording Manager

Purpose: Record every camera feed and the final output automatically.

Tasks:
- Task 6.1: Per-camera recording — record each camera feed independently to separate files
- Task 6.2: Mixed output recording — record the final broadcast output
- Task 6.3: Segment by match/set — new file per set, named by match ID and set number
- Task 6.4: Disk space monitor — warn at 85%, critical at 95%, auto-stop at critical
- Task 6.5: Recording events — emit RECORDING_STARTED, RECORDING_STOPPED, DISK_SPACE_WARNING
- Task 6.6: Recovery — handle unexpected stops without corrupting recorded files
- Task 6.7: Tests — unit tests for disk monitor, integration tests for record start/stop
- Task 6.8: README — where recordings are saved, how to configure path

Test gate: Files are valid after unexpected stop. Disk warning fires correctly. Coverage >= 90%. CI green → move to Module 7.

---

### MODULE 7 — Web Dashboard

Purpose: Director's control panel — see all cameras, switch scenes, update score, monitor stream health.

Tasks:
- Task 7.1: Camera grid — show live thumbnail previews of all cameras
- Task 7.2: Scene switcher panel — click a camera to switch to it live
- Task 7.3: Score panel — update score from dashboard
- Task 7.4: Broadcast panel — enter stream key, start/stop broadcast
- Task 7.5: Health monitor panel — show bitrate, dropped frames, latency per camera
- Task 7.6: Recording status — show recording state and disk usage
- Task 7.7: WebSocket integration — all panels update in real time without page refresh
- Task 7.8: Tests — component tests, E2E tests for full director flow
- Task 7.9: README — how to access and use the dashboard

Test gate: Full director flow works end-to-end in E2E test. Coverage >= 90%. CI green → move to Module 8.

---

### MODULE 8 — Mobile Controller (PWA)

Purpose: Scorekeeper's phone app to update score from the field without going to the laptop.

Tasks:
- Task 8.1: Score control UI — large buttons to increment/decrement score for each team
- Task 8.2: Set management — start new set, end current set
- Task 8.3: Player substitution log — record which player was substituted and when
- Task 8.4: Offline support — queue score changes if WiFi drops, sync when reconnected
- Task 8.5: PWA setup — installable on Android/iPhone home screen, works offline
- Task 8.6: Authentication — PIN-based access so only the scorekeeper can change the score
- Task 8.7: Tests — unit tests for offline queue, E2E tests for score update flow
- Task 8.8: README — how to install PWA on phone, how to use during a match

Test gate: Offline queue syncs correctly. Score update round-trip < 200ms on WiFi. Coverage >= 90%. CI green → platform complete.

---

## 7. Build Order

Build strictly in this order. Do not start a module until the previous one passes its test gate.

```
Phase 0 (Foundation)
  └── FOUNDATION tasks F1 → F5

Phase 1 (Core Pipeline — 2 camera experiment)
  └── Module 1: Camera Ingestion
  └── Module 2: Stream Engine
  └── Module 3: Scoreboard Overlay
  └── TEST: stream 2 cameras locally on LAN with score overlay ✓

Phase 2 (Broadcast Ready)
  └── Module 6: Recording Manager
  └── Module 4: Broadcast Manager
  └── TEST: stream live to YouTube with recording ✓

Phase 3 (Full Production Control)
  └── Module 5: Scene Switcher
  └── Module 7: Web Dashboard
  └── Module 8: Mobile Controller
  └── TEST: full match broadcast with all controls ✓

Phase 4 (Scale & Deploy)
  └── Docker production build
  └── Cloud deployment
  └── Load testing with k6
```

---

## 8. Testing Strategy

### Coverage Requirement: 90% minimum across all modules

### Test Types Per Module

| Test Type | Tool | Purpose |
|---|---|---|
| Unit | Vitest | Test individual functions and classes in isolation |
| Integration | Vitest | Test module APIs, database operations, event flows |
| End-to-End | Playwright | Test full user flows in browser (dashboard, overlay, mobile) |
| Load | k6 | Simulate 100+ concurrent viewers, measure stream stability |
| Security | npm audit + Snyk | Detect vulnerable dependencies |
| Memory | Node.js --expose-gc | Assert heap does not grow over repeated operations |

### What Every Module Must Have
- Tests for the happy path (everything works correctly)
- Tests for error cases (camera disconnects, network drops, invalid input)
- Tests for boundary values (score at max, disk at 95%, max cameras)
- Tests for async timeouts and retries
- All external dependencies mocked (FFmpeg, cameras, network, database)

### CI Coverage Gate
- Coverage report generated on every PR
- PR is blocked from merge if coverage drops below 90%
- Coverage report posted as a comment on the PR automatically

---

## 9. Coding Standards

### TypeScript
- Strict mode always on
- No `any` type anywhere
- All function parameters and return types explicitly declared
- Use `const` by default, `let` only when mutation is needed
- Use `readonly` on all data that should not change

### Functions and Files
- Maximum function length: 30 lines (extract helper if longer)
- Maximum file length: 300 lines (split if longer)
- Every public function must have a JSDoc comment explaining what it does

### Error Handling
- Every async function must have try/catch or return a typed Result/Error
- Error messages must be descriptive and include context (not just "error occurred")
- Never swallow errors silently

### Logging
- No `console.log` anywhere in production code
- Use Pino structured logger throughout
- Log levels: error, warn, info, debug — use them correctly
- Never log secrets, stream keys, or JWT tokens

### No Magic Numbers
- Every number and string constant lives in `shared/constants/`
- Named constants explain their purpose
- Example: use `SCORE.MAX_POINTS_PER_SET` not `25`

### Dependencies
- All dependencies pinned to exact versions (no ^ or ~ in package.json)
- Before adding any new dependency: check npm audit, check last published date, check weekly downloads
- Prefer built-in Node.js APIs over adding a new package

---

## 10. Security Plan

### Secrets
- All secrets (stream keys, JWT secret) in `.env` files
- `.env` never committed to git (in .gitignore)
- Stream keys encrypted at rest using AES-256 before storing in database
- `.env.example` provided with placeholder values

### Input Validation
- Every API endpoint validates its input using Zod schema before processing
- All data passed to FFmpeg is sanitized to prevent command injection
- File paths are validated to prevent directory traversal attacks

### API Security
- Rate limiting on all HTTP endpoints (100 requests per minute per IP)
- WebSocket connections require a short-lived JWT token
- CORS configured to only allow the dashboard origin

### Dependency Security
- `npm audit` runs in CI on every PR — blocks merge if high/critical vulnerabilities found
- Snyk scan runs weekly and creates GitHub issues for new vulnerabilities
- Dependencies reviewed before every release

---

## 11. Performance Plan

### Stream Latency
- HLS segment size: 2 seconds (low latency)
- WebSocket score updates: debounced at 100ms, appear on overlay within 200ms
- Scene switch (cut): completes within 100ms
- Scene switch (fade): completes within 600ms

### Memory Management
- FFmpeg processes: strict lifecycle management — every process tracked, cleaned up on stop
- No orphan processes — verified in tests using process listing
- Event bus listeners: every `on()` subscription returns an unsubscribe function — always called on cleanup
- Node.js heap: monitored in tests using `--expose-gc` flag

### CPU / Encoding
- FFmpeg uses hardware acceleration where available (VAAPI on Linux, VideoToolbox on Mac)
- Thumbnail generation: 1 frame per second maximum (not every frame)
- Quality profiles tuned per hardware capability

### Frontend
- React overlays use `React.memo` to prevent unnecessary re-renders
- Overlay only re-renders when score actually changes
- Dashboard thumbnails lazy-loaded

---

## 12. Design Patterns

| Pattern | Module | Why |
|---|---|---|
| Singleton | Event Bus, DB connection | One shared instance across the entire system |
| Observer | Event Bus usage across all modules | Decouple modules — no direct imports between modules |
| Strategy | Stream Engine quality profiles | Swap transcoding strategy at runtime without changing core logic |
| Adapter | Broadcast Manager platform adapters | One interface, swap between YouTube / Facebook / custom |
| State Machine | Scene Switcher | Predictable, safe scene transitions — prevents invalid states |
| Factory | Camera source creation | Create different camera types (RTMP, USB, NDI) through one interface |
| Repository | Database access in all modules | Business logic never talks to database directly |

---

## 13. Infrastructure & Deployment

### Local Development
- `docker-compose up` starts all services on the laptop
- nginx RTMP server runs in Docker
- All services on localhost with known ports

### Port Map
```
1935  → RTMP (camera input + broadcast output)
4000  → Backend API
4001  → WebSocket server
3000  → Web Dashboard
3001  → Scoreboard Overlay (browser source URL for OBS)
5432  → PostgreSQL (production)
```

### Production Deployment (Phase 4)
- Backend deployed to a Linux VPS or cloud VM
- Frontend (dashboard + overlay) served via nginx static hosting
- PostgreSQL replaces SQLite
- PM2 manages Node.js processes
- SSL certificates via Let's Encrypt
- Automated backups of database and recordings

### Docker Services
```
nginx-rtmp     → RTMP media server
api-server     → Express + Socket.IO backend
web-dashboard  → React dashboard (served by nginx)
overlay        → React overlay (served by nginx)
database       → PostgreSQL
```

---

## 14. Scalability Roadmap

### Phase 1 — Experiment (2 cameras, LAN)
- Modules: 1, 2, 3
- Hardware: 2 phones + 1 laptop
- Viewers: people on same WiFi
- Manual OBS for switching

### Phase 2 — Local Broadcast (4-6 cameras, YouTube)
- Add Modules: 4, 6
- Hardware: add camera stands, better phones
- Viewers: YouTube subscribers
- Score overlay live on YouTube

### Phase 3 — Full Production (8 cameras, full control)
- Add Modules: 5, 7, 8
- Hardware: add drone for aerial, dedicated laptop for production
- Viewers: public YouTube/Facebook channel
- Director switches scenes, scorekeeper on phone

### Phase 4 — Platform (multi-venue, cloud)
- Cloud deployment
- Multiple simultaneous match streams
- Highlight clip auto-generation
- Basic ball/player tracking with OpenCV/Python
- Viewer statistics and analytics
- Subscription model for clubs

---

## 15. How to Build Guide

This guide will live in `docs/HOW_TO_BUILD.md` (created during Foundation tasks).

It will cover:
- Prerequisites (Node.js, pnpm, Docker, FFmpeg versions)
- Clone and initial setup steps
- Environment variable configuration
- How to run a single module in development
- How to run the full system with Docker Compose
- How to run tests for one module
- How to run all tests and generate coverage report
- How to build for production
- Troubleshooting common setup issues

---

## 16. How to Use Guide

This guide will live in `docs/HOW_TO_USE.md` (created during Foundation tasks).

It will cover:
- Match day hardware setup (where to place cameras, how to connect phones)
- Step-by-step: connecting cameras to the system
- Step-by-step: setting up OBS with the score overlay
- Step-by-step: going live on YouTube
- How to use the Web Dashboard during a match
- How to install the Mobile Controller on a scorekeeper's phone
- How to find recordings after the match
- Glossary of terms for non-technical team members

---

## Module Prompt Reference

When you are ready to build each module, use these prompts:

```
FOUNDATION:  "Build the Foundation layer for VollyCast"
MODULE 1:    "Build Module 1 — Camera Ingestion Service for VollyCast"
MODULE 2:    "Build Module 2 — Stream Engine for VollyCast"
MODULE 3:    "Build Module 3 — Scoreboard Overlay Service for VollyCast"
MODULE 4:    "Build Module 4 — Broadcast Manager for VollyCast"
MODULE 5:    "Build Module 5 — Scene Switcher for VollyCast"
MODULE 6:    "Build Module 6 — Recording Manager for VollyCast"
MODULE 7:    "Build Module 7 — Web Dashboard for VollyCast"
MODULE 8:    "Build Module 8 — Mobile Controller for VollyCast"
```

Each prompt will produce: full implementation + full tests + README for that module only.
Do not move to the next module until the current one passes its test gate.

---

*VollyCast — Built in DG Khan. Ready for the world.*
