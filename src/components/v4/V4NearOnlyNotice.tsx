'use client';

import { useV4Actor } from '@/providers/V4ActorProvider';
import { V4Banner } from '@/components/v4/V4Banner';

/** Shown where an action needs a NEAR wallet (token deposits and withdrawals) while EVM mode is active. */
export function V4NearOnlyNotice({ what }: { what: string }) {
  const { mode, setMode } = useV4Actor();
  if (mode !== 'evm') return null;
  return (
    <div className="mb-4">
      <V4Banner tone="warning">
        {what} moves tokens to or from a NEAR wallet, so it is NEAR-only.{' '}
        <button onClick={() => setMode('near')} className="underline font-semibold">Switch to NEAR mode</button>
      </V4Banner>
    </div>
  );
}
