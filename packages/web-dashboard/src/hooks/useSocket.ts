/**
 * useSocket — connects to the scoreboard overlay WebSocket server.
 * Provides real-time score and match events to all panels.
 */

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Match } from '../api/types.js';

export interface SocketState {
  connected: boolean;
  match: Match | null;
}

const OVERLAY_URL = 'http://localhost:3001';
const OVERLAY_PATH = '/overlay-ws';

export function useSocket(): SocketState {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    const socket = io(OVERLAY_URL, { path: OVERLAY_PATH });
    socketRef.current = socket;

    socket.on('connect', (): void => { setConnected(true); });
    socket.on('disconnect', (): void => { setConnected(false); });

    socket.on('score:update', (data: Match) => {
      setMatch(data);
    });

    socket.on('match:started', (data: Match) => {
      setMatch(data);
    });

    socket.on('set:completed', (data: Match) => {
      setMatch(data);
    });

    socket.on('match:completed', (data: Match) => {
      setMatch(data);
    });

    return (): void => {
      socket.disconnect();
    };
  }, []);

  return { connected, match };
}
