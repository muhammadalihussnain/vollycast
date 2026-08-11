/**
 * usePolling — polls an async function at a given interval.
 * Used for camera list, scene list, broadcast status, and health.
 */

import { useEffect, useState, useCallback } from 'react';

/** Interval in ms between polls */
const DEFAULT_INTERVAL_MS = 3000;

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs = DEFAULT_INTERVAL_MS,
): { data: T | null; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((): void => {
    fetcher()
      .then((result): void => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown): void => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  }, [fetcher]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return (): void => { clearInterval(timer); };
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
