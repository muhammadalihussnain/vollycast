/**
 * useOfflineQueue — Task 8.4
 *
 * Queues score actions when offline, replays them when connection restores.
 * Persists the queue to localStorage so it survives page reloads.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { incrementScore, decrementScore, completeSet } from '../api/client.js';

export type QueuedAction =
  | { type: 'increment'; side: 'home' | 'away'; matchId: string }
  | { type: 'decrement'; side: 'home' | 'away'; matchId: string }
  | { type: 'completeSet'; matchId: string };

export type QueuedActionInput =
  | { type: 'increment'; side: 'home' | 'away' }
  | { type: 'decrement'; side: 'home' | 'away' }
  | { type: 'completeSet' };

const STORAGE_KEY = 'vollycast_offline_queue';
const ONLINE_CHECK_URL = '/api/match/ping';

function loadQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw !== null ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useOfflineQueue(matchId: string | null): {
  isOnline: boolean;
  pendingCount: number;
  enqueue: (action: QueuedActionInput) => void;
  syncNow: () => Promise<void>;
} {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedAction[]>(loadQueue);
  const syncingRef = useRef(false);

  // Listen to browser online/offline events
  useEffect(() => {
    const onOnline = (): void => { setIsOnline(true); };
    const onOffline = (): void => { setIsOnline(false); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return (): void => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  // Sync when coming back online — queue and syncQueue intentionally excluded
  // to avoid infinite loop (syncQueue modifies queue which would re-trigger)
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      void syncQueue(queue);
    }
  }, [isOnline]); // only re-run when online status changes

  const syncQueue = useCallback(async (pending: QueuedAction[]): Promise<void> => {
    if (syncingRef.current || pending.length === 0) return;
    syncingRef.current = true;

    const remaining: QueuedAction[] = [];
    for (const action of pending) {
      try {
        if (action.type === 'increment') {
          await incrementScore(action.matchId, action.side);
        } else if (action.type === 'decrement') {
          await decrementScore(action.matchId, action.side);
        } else {
          await completeSet(action.matchId);
        }
      } catch {
        // If the action fails during sync, keep it in the queue
        remaining.push(action);
      }
    }

    setQueue(remaining);
    syncingRef.current = false;
  }, []);

  const enqueue = useCallback((action: QueuedActionInput): void => {
    if (matchId === null) return;
    const full = { ...action, matchId } as QueuedAction;

    // Check real network connectivity first
    fetch(ONLINE_CHECK_URL, { method: 'HEAD' })
      .then(async (): Promise<void> => {
        // Online — execute directly
        if (action.type === 'increment') await incrementScore(matchId, action.side);
        else if (action.type === 'decrement') await decrementScore(matchId, action.side);
        else await completeSet(matchId);
      })
      .catch((): void => {
        // Offline — queue it
        setQueue((prev) => [...prev, full]);
      });
  }, [matchId]);

  const syncNow = useCallback(async (): Promise<void> => {
    await syncQueue(queue);
  }, [syncQueue, queue]);

  return { isOnline, pendingCount: queue.length, enqueue, syncNow };
}
