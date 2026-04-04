// Centralized RPC configuration for Base

const DEFAULT_RPC = 'https://base-rpc.publicnode.com';
export const FALLBACK_RPCS = [
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
    'https://base.meowrpc.com',
    'https://1rpc.io/base',
    'https://base.llamarpc.com',
    'https://rpc.ankr.com/base',
    'https://base-mainnet.public.blastapi.io',
    'https://base.gateway.tenderly.co',
    'https://base.public.blockpi.network/v1/rpc/public',
    'https://base.lava.build',
    'https://base-public.nodies.app',
    'https://api.zan.top/base-mainnet',
    'https://base.rpc.subquery.network/public',
    'https://base.api.onfinality.io/public',
    'https://base.drpc.org',
    'https://developer-access-mainnet.base.org',
    'https://base.rpc.blxrbdn.com',
    'https://gateway.tenderly.co/public/base',
    'https://public.stackup.sh/api/v1/node/base-mainnet',
    'https://endpoints.omniatech.io/v1/base/mainnet/public',
];

function getPrimaryRpc(): string {
    return process.env.NEXT_PUBLIC_BASE_RPC_URL || DEFAULT_RPC;
}

export function getRpcForUserData(): string {
    return getPrimaryRpc();
}

export function getRpcForPoolData(): string {
    return getPrimaryRpc();
}

export function getRpcForVoting(): string {
    return getPrimaryRpc();
}

export function getRpcForQuotes(): string {
    return getPrimaryRpc();
}

export async function rpcCall<T = unknown>(
    method: string,
    params: unknown[],
    preferredRpc?: string
): Promise<T> {
    const rpcs = preferredRpc
        ? [preferredRpc, ...FALLBACK_RPCS.filter(r => r !== preferredRpc)]
        : [getPrimaryRpc(), ...FALLBACK_RPCS.filter(r => r !== getPrimaryRpc())];

    let lastError: Error = new Error('No RPC endpoints available');
    for (const rpc of rpcs) {
        try {
            const response = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method,
                    params,
                    id: 1,
                }),
            });

            if (response.status === 504 || response.status === 502 || response.status === 503) {
                lastError = new Error(`RPC gateway error (status=${response.status}) from ${rpc}`);
                continue;
            }

            const text = await response.text();
            let result: { error?: { message?: string }; result: T };
            try {
                result = JSON.parse(text) as typeof result;
            } catch {
                const ct = response.headers.get('content-type') || '';
                const snippet = text.slice(0, 200);
                lastError = new Error(`RPC returned non-JSON response (status=${response.status}, content-type=${ct}): ${snippet}`);
                continue;
            }
            if (result.error) {
                throw new Error(result.error.message || 'RPC error');
            }
            return result.result;
        } catch (err) {
            if (err instanceof Error && !err.message.startsWith('RPC')) throw err;
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }
    throw lastError;
}

// Max calls per single HTTP batch request — keeps any one RPC from being overwhelmed
const BATCH_CHUNK_SIZE = 12;

async function sendBatchChunk(
    chunk: Array<{ method: string; params: unknown[]; id: number }>,
    rpc: string
): Promise<Array<{ id: number; result: unknown }>> {
    const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
    });

    if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`RPC batch HTTP ${response.status} from ${rpc}`);
    }

    const text = await response.text();
    let results: Array<{ id: number; result: unknown }> | { result: unknown };
    try {
        results = JSON.parse(text) as typeof results;
    } catch {
        const ct = response.headers.get('content-type') || '';
        throw new Error(`RPC batch non-JSON (status=${response.status}, ct=${ct}): ${text.slice(0, 200)}`);
    }

    if (Array.isArray(results)) return results as Array<{ id: number; result: unknown }>;
    return [{ id: chunk[0]?.id ?? 1, result: (results as { result: unknown }).result }];
}

export async function batchRpcCall(
    calls: Array<{ method: string; params: unknown[] }>,
    preferredRpc?: string
): Promise<unknown[]> {
    if (calls.length === 0) return [];

    // Assign globally unique IDs so we can reassemble after chunking
    const tagged = calls.map((call, i) => ({ ...call, id: i + 1 }));

    // Split into chunks
    const chunks: typeof tagged[] = [];
    for (let i = 0; i < tagged.length; i += BATCH_CHUNK_SIZE) {
        chunks.push(tagged.slice(i, i + BATCH_CHUNK_SIZE));
    }

    // Build RPC rotation list — preferred first, then rest
    const primary = preferredRpc || getPrimaryRpc();
    const rotation = [primary, ...FALLBACK_RPCS.filter(r => r !== primary)];

    // Fire all chunks in parallel, each chunk tries RPCs in order on failure
    const chunkResults = await Promise.all(
        chunks.map(async (chunk, chunkIdx) => {
            // Stagger RPC selection so chunks spread across endpoints
            const orderedRpcs = [
                rotation[chunkIdx % rotation.length],
                ...rotation.filter((_, i) => i !== chunkIdx % rotation.length),
            ];

            let lastErr: Error = new Error('No RPC available');
            for (const rpc of orderedRpcs) {
                try {
                    return await sendBatchChunk(chunk, rpc);
                } catch (err) {
                    lastErr = err instanceof Error ? err : new Error(String(err));
                }
            }
            // If all RPCs fail for this chunk, return nulls so callers degrade gracefully
            console.warn('[batchRpcCall] All RPCs failed for chunk:', lastErr.message);
            return chunk.map(c => ({ id: c.id, result: null }));
        })
    );

    // Flatten and sort by original ID to restore call order
    const flat = chunkResults.flat().sort((a, b) => a.id - b.id);
    return flat.map(r => r.result);
}

export async function ethCall(to: string, data: string): Promise<string> {
    return rpcCall<string>('eth_call', [{ to, data }, 'latest']);
}
