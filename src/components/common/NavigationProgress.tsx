'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thin top progress bar that shows instantly when navigation starts.
 * Uses pathname change to detect when navigation completes.
 * On slow connections this gives users clear feedback that their tap worked.
 */
export function NavigationProgress() {
    const pathname = usePathname();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const prevPathname = useRef(pathname);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rafRef = useRef<number | null>(null);

    // Expose a trigger so nav components can start the bar immediately on click/tap
    useEffect(() => {
        const start = () => {
            setVisible(true);
            setProgress(0);
            // Animate quickly to 80% then slow down — simulates loading
            let p = 0;
            const tick = () => {
                p = p < 60 ? p + 8 : p < 80 ? p + 1 : p + 0.2;
                if (p > 80) p = 80;
                setProgress(p);
                if (p < 80) rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        };

        const complete = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            setProgress(100);
            timerRef.current = setTimeout(() => {
                setVisible(false);
                setProgress(0);
            }, 300);
        };

        window.__navProgressStart = start;
        window.__navProgressComplete = complete;
    }, []);

    // Detect navigation complete via pathname change
    useEffect(() => {
        if (pathname !== prevPathname.current) {
            prevPathname.current = pathname;
            window.__navProgressComplete?.();
        }
    }, [pathname]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed top-0 left-0 z-[9999] h-[2px] bg-gradient-to-r from-primary via-accent to-primary pointer-events-none"
            style={{
                width: `${progress}%`,
                transition: progress === 100 ? 'width 0.1s ease-out' : 'width 0.08s linear',
                boxShadow: '0 0 8px rgba(245, 158, 11, 0.8)',
            }}
        />
    );
}
