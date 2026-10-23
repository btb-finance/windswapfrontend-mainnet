'use client';

import { useState } from 'react';
import { V4_CONTRACT_ID } from '@/lib/v4/config';
import { relayConfigured } from '@/lib/v4/relay';
import { useV4Actor } from '@/providers/V4ActorProvider';

/**
 * The last EVM-signed action. With no relayer configured, this is the payload an operator needs:
 * `execute` on the contract with these arguments, submitted by a NEAR account that pays the gas.
 */
export function V4SignedPayload() {
  const { lastSigned, clearSigned } = useV4Actor();
  const [copied, setCopied] = useState<'json' | 'message' | null>(null);

  if (!lastSigned) return null;

  const relayBody = JSON.stringify(
    {
      contractId: V4_CONTRACT_ID,
      method: 'execute',
      args: {
        wallet: lastSigned.wallet,
        action: lastSigned.action,
        nonce: lastSigned.nonce,
        expires: lastSigned.expires,
        signature: lastSigned.signature,
      },
    },
    null,
    2,
  );

  async function copy(kind: 'json' | 'message', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="swap-card mb-4 space-y-3" role="status">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">Signed: {lastSigned.label}</div>
          <div className="text-xs text-gray-400">
            {relayConfigured()
              ? 'Sent to the relayer. The contract checks the signature and nonce.'
              : 'No relayer is set. Give this JSON to an operator who calls execute on the contract (the caller pays gas).'}
          </div>
        </div>
        <button onClick={clearSigned} className="btn-secondary px-2 py-1 text-xs shrink-0">Dismiss</button>
      </div>
      <pre className="text-[11px] font-mono bg-black/30 rounded-lg p-3 overflow-x-auto max-h-56 whitespace-pre-wrap break-all">{relayBody}</pre>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void copy('json', relayBody)} className="btn-primary px-3 py-2 text-xs">
          {copied === 'json' ? 'Copied' : 'Copy relay JSON'}
        </button>
        <button onClick={() => void copy('message', lastSigned.message)} className="btn-secondary px-3 py-2 text-xs">
          {copied === 'message' ? 'Copied' : 'Copy signed message'}
        </button>
      </div>
    </div>
  );
}
