'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Polling hook with visibility-based pause.
 * Replaces the duplicated setInterval + visibilityState pattern
 * in useSubgraph, useWindPrice, and UserBalanceProvider.
 */
export function usePolling(
    fn: () => Promise<void> | void,
    intervalMs: number,
    options: { enabled?: boolean } = {},
) {
    const { enabled = true } = options;
    const [isPolling, setIsPolling] = useState(false);
    const fnRef = useRef(fn);
    fnRef.current = fn;

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        const tick = async () => {
            if (document.visibilityState === 'hidden') return;
            try {
                setIsPolling(true);
                await fnRef.current();
            } finally {
                if (!cancelled) setIsPolling(false);
            }
        };

        // Initial fetch
        tick();

        const id = setInterval(tick, intervalMs);

        // Re-fetch when tab becomes visible
        const onVisible = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [intervalMs, enabled]);

    return { isPolling };
}
