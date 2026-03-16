'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '@/hooks/useHaptic';
import { CheckIcon, ErrorIcon, WarningIcon, InfoIcon } from '@/components/common/Icons';
import { UI } from '@/config/constants';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    createdAt: number;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const toastStyles: Record<ToastType, string> = {
    success: 'bg-green-500/90 border-green-400/50',
    error: 'bg-red-500/90 border-red-400/50',
    warning: 'bg-yellow-500/90 border-yellow-400/50',
    info: 'bg-primary/90 border-primary/50',
};

const ToastIcon = ({ type }: { type: ToastType }) => {
    const className = "w-5 h-5 text-white";
    switch (type) {
        case 'success': return <CheckIcon className={className} />;
        case 'error': return <ErrorIcon className={className} />;
        case 'warning': return <WarningIcon className={className} />;
        case 'info': return <InfoIcon className={className} />;
    }
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback(
        (message: string, type: ToastType = 'info', duration?: number) => {
            const id = `${Date.now()}-${Math.random()}`;
            const toastDuration = duration ?? (
                type === 'success' ? UI.TOAST_SUCCESS_DURATION :
                type === 'error' ? UI.TOAST_ERROR_DURATION :
                UI.TOAST_DURATION
            );
 
            // Haptic feedback based on type
            if (type === 'success') haptic('success');
            else if (type === 'error') haptic('error');
            else if (type === 'warning') haptic('warning');
            else haptic('light');
 
            setToasts((prev) => [...prev, { id, message, type, duration: toastDuration, createdAt: Date.now() }]);
 
            if (toastDuration > 0) {
                setTimeout(() => removeToast(id), toastDuration);
            }
        },
        [removeToast]
    );

    const contextValue: ToastContextType = {
        toast: addToast,
        success: (msg, dur) => addToast(msg, 'success', dur),
        error: (msg, dur) => addToast(msg, 'error', dur),
        warning: (msg, dur) => addToast(msg, 'warning', dur),
        info: (msg, dur) => addToast(msg, 'info', dur),
    };

    return (
        <ToastContext.Provider value={contextValue}>
            {children}

            {/* Toast Container - fixed at top for mobile */}
            <div className="fixed top-16 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {toasts.map((toast) => {
                        const progress = ((Date.now() - toast.createdAt) / (toast.duration || UI.TOAST_DURATION)) * 100;
                        return (
                            <motion.div
                                key={toast.id}
                                initial={{ opacity: 0, y: -50, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                className={`pointer-events-auto max-w-sm w-full px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg ${toastStyles[toast.type]}`}
                                onClick={() => removeToast(toast.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <ToastIcon type={toast.type} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-white text-sm font-medium block">
                                            {toast.message}
                                        </span>
                                        {/* Progress bar for auto-dismiss */}
                                        {toast.duration && toast.duration > 0 && (
                                            <div className="mt-1.5 h-0.5 bg-white/20 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-white/60 rounded-full"
                                                    initial={{ width: '0%' }}
                                                    animate={{ width: `${100 - Math.min(progress, 100)}%` }}
                                                    transition={{ duration: 0.1 }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextType {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
