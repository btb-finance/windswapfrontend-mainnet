'use client';

import { useV4Actor } from '@/providers/V4ActorProvider';
import { V4Banner } from '@/components/v4/V4Banner';

/** Shown on NEAR-only pages while EVM mode is active. */
export function V4NearOnlyNotice({ what }: { what: string }) {
  const { mode, setMode } = useV4Actor();
  if (mode !== 'evm') return null;
  return (
    <div className="max-w-2xl mx-auto mb-4">
      <V4Banner tone="warning">
        {what} is NEAR-only for now. EVM wallets can swap, lock, vote and claim, and bridge funds on the Bridge page.{' '}
        <button onClick={() => setMode('near')} className="underline font-semibold">Switch to NEAR mode</button>
      </V4Banner>
    </div>
  );
}
