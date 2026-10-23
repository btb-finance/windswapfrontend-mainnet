'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { NearConnectButton } from '@/components/v4/NearConnectButton';
import { useV4Actor, type V4Mode } from '@/providers/V4ActorProvider';

const OPTIONS: Array<{ mode: V4Mode; label: string }> = [
  { mode: 'near', label: 'NEAR' },
  { mode: 'evm', label: 'EVM' },
];

/** NEAR / EVM wallet mode switch, with the connect button of the active mode. */
export function V4ModeSwitch() {
  const { mode, setMode } = useV4Actor();

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Wallet mode" className="flex rounded-lg bg-white/5 border border-white/10 p-0.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setMode(opt.mode)}
            aria-pressed={mode === opt.mode}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
              mode === opt.mode ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === 'near' ? (
        <NearConnectButton />
      ) : (
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
      )}
    </div>
  );
}
