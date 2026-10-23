'use client';

import type { ReactNode } from 'react';
import { useV4Actor } from '@/providers/V4ActorProvider';

/**
 * Shows the children only when the active wallet is connected. With `evmOnly`, NEAR mode gets a
 * prompt to switch to the EVM wallet instead.
 */
export function V4WalletGate({ children, evmOnly = false }: { children: ReactNode; evmOnly?: boolean }) {
  const { mode, setMode, connected, connect } = useV4Actor();

  if (evmOnly && mode !== 'evm') {
    return (
      <div className="max-w-md mx-auto swap-card text-center space-y-4">
        <p className="text-sm text-gray-300">This page moves funds between Base Sepolia and the DEX. It uses an EVM wallet (MetaMask).</p>
        <button onClick={() => setMode('evm')} className="btn-primary px-6 py-3">Use EVM wallet</button>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-md mx-auto swap-card text-center space-y-4">
        <p className="text-sm text-gray-300">
          {mode === 'near' ? 'Connect a NEAR testnet wallet to continue.' : 'Connect an EVM wallet (MetaMask or another injected wallet) to continue.'}
        </p>
        <button onClick={connect} className="btn-primary px-6 py-3">
          {mode === 'near' ? 'Connect NEAR wallet' : 'Connect EVM wallet'}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
