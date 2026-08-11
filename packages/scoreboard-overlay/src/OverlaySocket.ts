/**
 * OverlaySocket — Task 3.4
 *
 * Pushes score and match events to all connected overlay clients in real time.
 * Design pattern: Observer — subscribes to EventBus and forwards to Socket.IO room.
 *
 * Memory leak prevention:
 * - EventBus subscriptions stored and unsubscribed on stop()
 * - Socket.IO server closed on stop()
 */

import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import {
  EventBus,
  VOLLYCAST_EVENTS,
  WS_ROOMS,
  type ScoreEventPayload,
} from '@vollycast/shared';
import { logger } from './logger.js';

/** Events sent to overlay clients */
export const OVERLAY_EVENTS = {
  SCORE_UPDATE: 'score:update',
  MATCH_STARTED: 'match:started',
  MATCH_COMPLETED: 'match:completed',
  SET_COMPLETED: 'set:completed',
  CONNECTED: 'connected',
} as const;

export class OverlaySocket {
  private io: SocketServer | null = null;
  private readonly bus: EventBus;
  private readonly unsubscribers: Array<() => void> = [];

  public constructor(bus?: EventBus) {
    this.bus = bus ?? EventBus.getInstance();
  }

  /**
   * Attach Socket.IO to an existing HTTP server and start listening for events.
   */
  public attach(httpServer: HttpServer): void {
    this.io = new SocketServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      path: '/overlay-ws',
    });

    this.io.on('connection', (socket) => {
      void socket.join(WS_ROOMS.OVERLAY);
      socket.emit(OVERLAY_EVENTS.CONNECTED, { room: WS_ROOMS.OVERLAY });
      logger.info({ socketId: socket.id }, 'Overlay client connected');

      socket.on('disconnect', (): void => {
        logger.info({ socketId: socket.id }, 'Overlay client disconnected');
      });
    });

    this.subscribeToEvents();
    logger.info({}, 'OverlaySocket attached');
  }

  /**
   * Stop and clean up — unsubscribe from EventBus, close Socket.IO.
   */
  public stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;

    if (this.io !== null) {
      this.io.close();
      this.io = null;
    }
  }

  /**
   * Number of connected overlay clients. Used in tests.
   */
  public clientCount(): number {
    return this.io?.sockets.sockets.size ?? 0;
  }

  private subscribeToEvents(): void {
    const unsubScore = this.bus.on<ScoreEventPayload>(
      VOLLYCAST_EVENTS.SCORE_UPDATED,
      (payload): void => {
        this.broadcast(OVERLAY_EVENTS.SCORE_UPDATE, payload);
      },
    );

    const unsubMatchStart = this.bus.on(
      VOLLYCAST_EVENTS.MATCH_STARTED,
      (payload): void => {
        this.broadcast(OVERLAY_EVENTS.MATCH_STARTED, payload);
      },
    );

    const unsubMatchEnd = this.bus.on(
      VOLLYCAST_EVENTS.MATCH_COMPLETED,
      (payload): void => {
        this.broadcast(OVERLAY_EVENTS.MATCH_COMPLETED, payload);
      },
    );

    const unsubSetComplete = this.bus.on(
      VOLLYCAST_EVENTS.SET_COMPLETED,
      (payload): void => {
        this.broadcast(OVERLAY_EVENTS.SET_COMPLETED, payload);
      },
    );

    this.unsubscribers.push(unsubScore, unsubMatchStart, unsubMatchEnd, unsubSetComplete);
  }

  private broadcast(event: string, payload: unknown): void {
    if (this.io === null) return;
    this.io.to(WS_ROOMS.OVERLAY).emit(event, payload);
    logger.debug({ event }, 'Broadcast to overlay room');
  }
}
