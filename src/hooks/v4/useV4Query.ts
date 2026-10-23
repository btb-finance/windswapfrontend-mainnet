'use client';

import { useCallback, useEffect, useState } from 'react';
import { readableNearError } from '@/lib/v4/near';

export interface V4Query<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Runs `fetcher` when `key` is not null, and again on refresh or every `pollMs`. `key` must name
 * every input of `fetcher`. Data from an older key is never returned.
 */
export function useV4Query<T>(key: string | null, fetcher: () => Promise<T>, pollMs = 0): V4Query<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error: string | null }>({ key: null, error: null });
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    const load = () => {
      setLoading(true);
      fetcher()
        .then((data) => {
          if (!cancelled) setState({ key, data, error: null });
        })
        .catch((err: unknown) => {
          if (!cancelled) setState((prev) => ({ key, data: prev.key === key ? prev.data : undefined, error: readableNearError(err) }));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const timer = pollMs > 0 ? setInterval(load, pollMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // `fetcher` is intentionally not a dependency: callers pass a new closure each render. `key` covers its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, pollMs]);

  if (key === null) return { data: undefined, error: null, loading: false, refresh };
  const matches = state.key === key;
  return { data: matches ? state.data : undefined, error: matches ? state.error : null, loading, refresh };
}
