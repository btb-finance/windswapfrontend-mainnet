'use client';

import { useState, useCallback, useRef, TouchEvent } from 'react';
import { haptic } from '@/hooks/useHaptic';

interface UseSwipeToDismissOptions {
    onDismiss: () => void;
    threshold?: number;
    direction?: 'down' | 'up' | 'left' | 'right';
}

interface UseSwipeToDismissReturn {
    isDragging: boolean;
    dragProgress: number;
    handlers: {
        onTouchStart: (e: TouchEvent) => void;
        onTouchMove: (e: TouchEvent) => void;
        onTouchEnd: () => void;
    };
    style: {
        transform: string;
        transition: string;
        opacity: number;
    };
}

/**
 * Swipe-to-dismiss hook for modals and bottom sheets
 * Perfect for mobile UX - swipe down to close
 */
export function useSwipeToDismiss({
    onDismiss,
    threshold = 100,
    direction = 'down',
}: UseSwipeToDismissOptions): UseSwipeToDismissReturn {
    const [isDragging, setIsDragging] = useState(false);
    const [dragDistance, setDragDistance] = useState(0);
    
    const startY = useRef(0);
    const startX = useRef(0);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        startY.current = touch.clientY;
        startX.current = touch.clientX;
        setIsDragging(true);
        setDragDistance(0);
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging) return;

        const touch = e.touches[0];
        const deltaY = touch.clientY - startY.current;
        const deltaX = touch.clientX - startX.current;

        // Calculate drag based on direction
        let distance = 0;
        switch (direction) {
            case 'down':
                // Only allow dragging down (positive deltaY)
                if (deltaY > 0) distance = deltaY;
                break;
            case 'up':
                if (deltaY < 0) distance = Math.abs(deltaY);
                break;
            case 'left':
                if (deltaX < 0) distance = Math.abs(deltaX);
                break;
            case 'right':
                if (deltaX > 0) distance = deltaX;
                break;
        }

        // Apply resistance - harder to drag as you go further
        const resistance = 0.6;
        setDragDistance(distance * resistance);
    }, [isDragging, direction]);

    const handleTouchEnd = useCallback(() => {
        if (!isDragging) return;

        if (dragDistance >= threshold) {
            haptic('medium');
            onDismiss();
        }

        setIsDragging(false);
        setDragDistance(0);
    }, [isDragging, dragDistance, threshold, onDismiss]);

    // Calculate transform and opacity based on drag
    const progress = Math.min(dragDistance / threshold, 1);
    
    let transform = '';
    switch (direction) {
        case 'down':
        case 'up':
            transform = `translateY(${direction === 'down' ? dragDistance : -dragDistance}px)`;
            break;
        case 'left':
        case 'right':
            transform = `translateX(${direction === 'right' ? dragDistance : -dragDistance}px)`;
            break;
    }

    const style = {
        transform,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
        opacity: 1 - (progress * 0.5), // Fade out slightly as user drags
    };

    return {
        isDragging,
        dragProgress: progress,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        },
        style,
    };
}
