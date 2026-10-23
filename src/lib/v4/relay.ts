import type { SignedPayload } from './evm/signed';
import type { IntentCancelBody, IntentSubmitBody } from './intents';
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

/** Result of `POST /v1/intent`. `intentId` is what `get_intent` and cancel take. */
export interface IntentSubmitResult {
  txHash?: string;
  intentId: string;
}

/** Relayer base URL without a trailing slash, with `path` appended. */
function relayUrl(path: string): string {
  if (!relayConfigured()) throw new Error('No relayer configured (NEXT_PUBLIC_V4_RELAY_URL).');
  return `${V4_RELAY_URL.replace(/\/+$/, '')}${path}`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(relayUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed: (T & { error?: string }) | null = null;
  try {
    parsed = (await res.json()) as T & { error?: string };
  } catch {
    // Non-JSON response: fall through to the HTTP status check.
  }
  if (!res.ok || parsed === null || parsed.error) {
    throw new Error(parsed?.error ?? `Relayer returned HTTP ${res.status}`);
  }
  return parsed;
}

/** `POST {relay}/v1/intent` with `{wallet, intent, nonce, expires, signature}`. */
export async function postIntent(body: IntentSubmitBody): Promise<IntentSubmitResult> {
  const result = await postJson<Partial<IntentSubmitResult>>('/v1/intent', body);
  if (result.intentId === undefined || result.intentId === null || result.intentId === '') {
    throw new Error('Relayer did not return an intentId.');
  }
  return { txHash: result.txHash, intentId: String(result.intentId) };
}

/** `POST {relay}/v1/intent/cancel` with `{wallet, id, nonce, expires, signature}`. */
export async function postIntentCancel(body: IntentCancelBody): Promise<{ txHash?: string }> {
  return postJson<{ txHash?: string }>('/v1/intent/cancel', body);
}

/** The body the operator needs when no relayer is set, for an intent submit. */
export function intentRelayJson(body: IntentSubmitBody): string {
  return JSON.stringify(body, null, 2);
}
