import type { SignedPayload } from './evm/signed';
import { V4_CONTRACT_ID, V4_RELAY_URL } from './config';

/** Result the relayer returns. Only `error` and `txHash` are read; `result` is the contract's ActionResult. */
export interface RelayResult {
  txHash?: string;
  result?: unknown;
  error?: string;
}

export function relayConfigured(): boolean {
  return V4_RELAY_URL.length > 0;
}

/**
 * POSTs a signed action to the relayer. Request body (JSON):
 * `{ "contractId": "...", "method": "execute", "args": { wallet, action, nonce, expires, signature } }`.
 * The relayer submits `execute` to NEAR with its own account and returns `{ txHash?, result?, error? }`.
 * The endpoint is not built yet (see docs/V4.md).
 */
export async function relayAction(payload: SignedPayload): Promise<RelayResult> {
  if (!relayConfigured()) throw new Error('No relayer configured (NEXT_PUBLIC_V4_RELAY_URL).');
  const res = await fetch(V4_RELAY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contractId: V4_CONTRACT_ID,
      method: 'execute',
      args: {
        wallet: payload.wallet,
        action: payload.action,
        nonce: payload.nonce,
        expires: payload.expires,
        signature: payload.signature,
      },
    }),
  });
  let body: RelayResult = {};
  try {
    body = (await res.json()) as RelayResult;
  } catch {
    // Non-JSON response: fall through to the HTTP status check.
  }
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `Relayer returned HTTP ${res.status}`);
  }
  return body;
}
