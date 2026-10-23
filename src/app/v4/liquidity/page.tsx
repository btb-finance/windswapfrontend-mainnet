'use client';

import { Suspense } from 'react';
import { V4LiquidityPanel } from '@/components/v4/V4LiquidityPanel';

export default function V4LiquidityPage() {
  return (
    <Suspense fallback={<div className="swap-card max-w-md mx-auto text-center text-sm text-gray-400 py-10">Loading...</div>}>
      <V4LiquidityPanel />
    </Suspense>
  );
}
