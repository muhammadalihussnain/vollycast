#!/usr/bin/env node
/**
 * VollyCast Host Agent
 *
 * Runs on the LAPTOP (not inside Docker).
 * Handles:
 *   1. Auto-detect laptop WiFi IP and subnet
 *   2. Scan network for IP Webcam devices
 *   3. Start/stop FFmpeg per camera
 *   4. Report status back to the browser
 *
 * Start: node scripts/host-agent.mjs
 * Port:  4001
 */

import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const AGENT_PORT = 4001;
const IP_WEBCAM_PORT = 8080;
const SCAN_TIMEOUT_MS = 800;
const FFMPEG_RESTART_DELAY_MS = 3000;
const SUBNET_OCTETS = 3;
const SUBNET_HOST_COUNT = 254;
const RTMP_PORT = 1935;

/** Running FFmpeg processes per camera name */
const ffmpegProcesses = new Map();

/** Camera configs: name → { ip, enabled } */
const cameras = new Map();

// ── Detect laptop WiFi IP ────────────────────────────────────────────────────

function detectLaptopIp() {
  const nets = networkInterfaces();
  const candidates = [];

  for (const [name, iface] of Object.entries(nets)) {
    if (!iface) continue;
    if (name.startsWith('docker') || name.startsWith('br-') ||
        name.startsWith('veth') || name === 'lo') continue;
    for (const net of iface) {
      if (net.internal || net.family !== 'IPv4') continue;
      if (net.address.startsWith('172.') || net.address.startsWith('127.')) continue;
      candidates.push(net.address);
    }
  }

  return candidates.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.'))
    ?? candidates[0]
    ?? '192.168.1.1';
}

function getSubnet(ip) {
  return ip.split('.').slice(0, SUBNET_OCTETS).join('.');
}

// ── Network scan ─────────────────────────────────────────────────────────────

async function checkIpWebcam(ip) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${ip}:${IP_WEBCAM_PORT}/photo.jpg`,
      { signal: controller.signal, method: 'HEAD' });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function scanNetwork(subnet) {
  console.log(`[scan] Scanning ${subnet}.1-${SUBNET_HOST_COUNT}...`);
  const ips = Array.from({ length: SUBNET_HOST_COUNT }, (_, i) => `${subnet}.${i + 1}`);
  const results = await Promise.all(ips.map(async ip => (await checkIpWebcam(ip)) ? ip : null));
  const found = results.filter(Boolean);
  console.log(`[scan] Found: ${found.join(', ') || 'none'}`);
  return found;
}

// ── FFmpeg management ────────────────────────────────────────────────────────

function startFfmpeg(camName, phoneIp) {
  stopFfmpeg(camName);

  const input = `http://${phoneIp}:${IP_WEBCAM_PORT}/video`;
  const output = `rtmp://localhost:${RTMP_PORT}/live/${camName}`;

  console.log(`[ffmpeg] Starting ${camName} from ${phoneIp}`);

  const proc = spawn('ffmpeg', [
    '-i', input,
    '-vcodec', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-vf', 'scale=640:480',
    '-b:v', '800k',
    '-f', 'flv',
    output,
  ], { stdio: 'ignore' });

  proc.on('exit', (code) => {
    console.log(`[ffmpeg] ${camName} exited (code ${code})`);
    ffmpegProcesses.delete(camName);
    const cam = cameras.get(camName);
    if (cam?.enabled) {
      console.log(`[ffmpeg] Restarting ${camName} in ${FFMPEG_RESTART_DELAY_MS}ms`);
      setTimeout(() => {
        if (cameras.get(camName)?.enabled) startFfmpeg(camName, cam.ip);
      }, FFMPEG_RESTART_DELAY_MS);
    }
  });

  ffmpegProcesses.set(camName, proc);
  return proc.pid;
}

function stopFfmpeg(camName) {
  const proc = ffmpegProcesses.get(camName);
  if (proc) {
    proc.kill('SIGTERM');
    ffmpegProcesses.delete(camName);
    console.log(`[ffmpeg] Stopped ${camName}`);
  }
}

// ── HTTP Server ──────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, data, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${AGENT_PORT}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // GET /status — laptop IP, subnet, running cameras
  if (req.method === 'GET' && path === '/status') {
    const laptopIp = detectLaptopIp();
    const subnet = getSubnet(laptopIp);
    const running = [];
    for (const [name, proc] of ffmpegProcesses) {
      running.push({ name, pid: proc.pid });
    }
    return json(res, { laptopIp, subnet, running, cameras: Object.fromEntries(cameras) });
  }

  // GET /scan — scan network for IP Webcam devices
  if (req.method === 'GET' && path === '/scan') {
    const laptopIp = detectLaptopIp();
    const subnet = url.searchParams.get('subnet') ?? getSubnet(laptopIp);
    const found = await scanNetwork(subnet);
    return json(res, { found, subnet, laptopIp });
  }

  // POST /connect — start FFmpeg for a camera
  if (req.method === 'POST' && path === '/connect') {
    const body = await readBody(req);
    const { name, ip } = body;
    if (!name || !ip) return json(res, { error: 'name and ip required' }, 400);

    cameras.set(name, { ip, enabled: true });
    const pid = startFfmpeg(name, ip);
    return json(res, { started: true, name, ip, pid });
  }

  // POST /disconnect — stop FFmpeg for a camera
  if (req.method === 'POST' && path === '/disconnect') {
    const body = await readBody(req);
    const { name } = body;
    if (!name) return json(res, { error: 'name required' }, 400);

    const cam = cameras.get(name);
    if (cam) { cam.enabled = false; cameras.set(name, cam); }
    stopFfmpeg(name);
    return json(res, { stopped: true, name });
  }

  json(res, { error: 'Not found' }, 404);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${AGENT_PORT} already in use. Run: lsof -ti:${AGENT_PORT} | xargs kill -9`);
    process.exit(1);
  }
  throw err;
});

server.listen(AGENT_PORT, () => {
  const ip = detectLaptopIp();
  const subnet = getSubnet(ip);
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       VollyCast Host Agent               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Laptop IP  : ${ip.padEnd(26)}║`);
  console.log(`║  Subnet     : ${subnet.padEnd(26)}║`);
  console.log(`║  Agent Port : ${String(AGENT_PORT).padEnd(26)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Ready. Open http://localhost:3000 in browser.');
  console.log('Press Ctrl+C to stop.');
});

process.on('SIGINT', () => {
  console.log('\nStopping all FFmpeg processes...');
  for (const [name] of ffmpegProcesses) stopFfmpeg(name);
  process.exit(0);
});
