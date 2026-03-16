'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt - Shows after 3 visits to encourage app installation
 * Only appears on mobile devices that support PWA installation
 */
export function PWAInstallPrompt() {
    const [isVisible, setIsVisible] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Only show on mobile/tablet
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) return;

        // Check if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as { standalone?: boolean }).standalone === true;
        if (isStandalone) return;

        // Track visits using localStorage
        const visitCount = parseInt(localStorage.getItem('windswap_visits') || '0');
        const hasDismissed = localStorage.getItem('windswap_install_dismissed') === 'true';
        const lastPrompt = parseInt(localStorage.getItem('windswap_install_last_prompt') || '0');
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        // Only show after 3 visits and not dismissed in last week
        if (visitCount >= 3 && !hasDismissed && (now - lastPrompt > oneWeek)) {
            // Capture the install prompt event
            const handleBeforeInstallPrompt = (e: Event) => {
                e.preventDefault();
                setDeferredPrompt(e as BeforeInstallPromptEvent);
                setIsVisible(true);
            };

            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

            // Also show for iOS (no beforeinstallprompt event)
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS && !hasDismissed) {
                setTimeout(() => setIsVisible(true), 2000);
            }

            return () => {
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };
        }
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                localStorage.setItem('windswap_install_accepted', 'true');
            }
        }
        setIsVisible(false);
        localStorage.setItem('windswap_install_last_prompt', Date.now().toString());
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('windswap_install_dismissed', 'true');
        localStorage.setItem('windswap_install_last_prompt', Date.now().toString());
    };

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-20 left-4 right-4 z-40 md:hidden"
                >
                    <div className="glass-card p-4 rounded-2xl border border-primary/30 shadow-lg">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                                <img src="/logo.png" alt="WindSwap" className="w-8 h-8" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm mb-1">Add WindSwap to Home Screen</h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    {isIOS 
                                        ? 'Tap the share button below, then "Add to Home Screen" for instant access.'
                                        : 'Install our app for faster swaps, push notifications, and offline access.'}
                                </p>
                            </div>
                            <button 
                                onClick={handleDismiss}
                                className="p-1 rounded-lg hover:bg-white/10 text-gray-400"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        {!isIOS && deferredPrompt && (
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={handleInstall}
                                    className="flex-1 btn-primary py-2.5 text-sm font-semibold"
                                >
                                    Install App
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-4 py-2.5 rounded-xl bg-white/5 text-sm text-gray-400 hover:bg-white/10"
                                >
                                    Later
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
