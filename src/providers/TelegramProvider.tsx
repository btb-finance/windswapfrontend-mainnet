'use client';

import { useEffect } from 'react';

// Detects if running inside Telegram and initialises the Mini App SDK.
// Lazy-loads the SDK only inside Telegram to avoid bundle bloat on normal loads.
export function TelegramProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Telegram injects window.Telegram.WebApp when the app runs inside Telegram
        const isTelegram = !!(window as Window & { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
        if (!isTelegram) return;

        import('@tma.js/sdk').then(({ retrieveLaunchParams, miniApp, viewport, backButton }) => {
            try {
                // Confirm we have valid launch params (throws if not in Telegram)
                retrieveLaunchParams();

                // Tell Telegram the app is ready — hides the native loading screen
                if (miniApp.isMounted()) {
                    miniApp.ready();
                } else {
                    miniApp.mount();
                    miniApp.ready();
                }

                // Expand to full screen
                if (!viewport.isMounted()) viewport.mount();
                viewport.expand();

                // Match Telegram header to our dark theme
                miniApp.setHeaderColor('#0a0b0d');

                // Hide the back button by default — we handle navigation ourselves
                if (backButton.isMounted()) {
                    backButton.hide();
                } else {
                    backButton.mount();
                    backButton.hide();
                }
            } catch {
                // Not a valid Telegram environment — silently ignore
            }
        }).catch(() => {});
    }, []);

    return <>{children}</>;
}
