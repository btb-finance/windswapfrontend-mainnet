'use client';

import { memo } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circle' | 'rect' | 'card' | 'button';
  width?: string | number;
  height?: string | number;
  count?: number;
}

/**
 * Skeleton loading component with shimmer effect
 * Use while content is loading to improve perceived performance
 * 
 * @example
 * // Basic text skeleton
 * <Skeleton variant="text" />
 * 
 * // Circle avatar skeleton
 * <Skeleton variant="circle" width={40} height={40} />
 * 
 * // Card skeleton
 * <Skeleton variant="card" />
 * 
 * // Multiple lines
 * <Skeleton variant="text" count={3} />
 */
export const Skeleton = memo(function Skeleton({
  className = '',
  variant = 'rect',
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const baseClasses = 'skeleton';
  
  const variantClasses: Record<string, string> = {
    text: 'skeleton-text',
    circle: 'skeleton-circle',
    rect: '',
    card: 'skeleton-card',
    button: 'skeleton-button',
  };

  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  const elements = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  ));

  if (count === 1) {
    return elements[0];
  }

  return (
    <div className="space-y-2" aria-hidden="true">
      {elements}
    </div>
  );
});

/**
 * Token pair skeleton - shows two overlapping circles
 */
export const SkeletonTokenPair = memo(function SkeletonTokenPair({
  size = 24,
}: {
  size?: number;
}) {
  return (
    <div className="flex items-center">
      <div
        className="skeleton skeleton-circle"
        style={{ width: size, height: size }}
      />
      <div
        className="skeleton skeleton-circle -ml-2"
        style={{ width: size, height: size }}
      />
    </div>
  );
});

/**
 * Pool row skeleton for pools/vote pages
 */
export const SkeletonPoolRow = memo(function SkeletonPoolRow() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SkeletonTokenPair />
          <div className="space-y-1">
            <Skeleton variant="text" width={100} height={16} />
            <Skeleton variant="text" width={60} height={12} />
          </div>
        </div>
        <div className="text-right space-y-1">
          <Skeleton variant="text" width={80} height={16} />
          <Skeleton variant="text" width={50} height={12} />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton variant="button" width={80} />
        <Skeleton variant="button" width={80} />
      </div>
    </div>
  );
});

/**
 * Position card skeleton for portfolio page
 */
export const SkeletonPositionCard = memo(function SkeletonPositionCard() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonTokenPair size={32} />
        <Skeleton variant="text" width={100} height={20} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Skeleton variant="text" width={60} height={12} />
          <Skeleton variant="text" width={80} height={16} />
        </div>
        <div className="space-y-1 text-right">
          <Skeleton variant="text" width={60} height={12} />
          <Skeleton variant="text" width={80} height={16} />
        </div>
      </div>
      <Skeleton variant="button" height={36} />
    </div>
  );
});

/**
 * Full page loading skeleton
 */
export const SkeletonPage = memo(function SkeletonPage({
  title = true,
  stats = 3,
  rows = 5,
}: {
  title?: boolean;
  stats?: number;
  rows?: number;
}) {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {title && (
        <Skeleton variant="text" width={200} height={32} />
      )}
      
      {stats > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="glass-card p-3 space-y-2">
              <Skeleton variant="text" width={80} height={12} />
              <Skeleton variant="text" width={60} height={20} />
            </div>
          ))}
        </div>
      )}
      
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonPoolRow key={i} />
        ))}
      </div>
    </div>
  );
});
