// Centralized RPC configuration for Base

const DEFAULT_RPC = 'https://base-rpc.publicnode.com';
const FALLBACK_RPCS = [
    'https://base-rpc.publicnode.com',
    'https://base.meowrpc.com',
    'https://rpc.ankr.com/base',
    'https://1rpc.io/base',
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

export async function batchRpcCall(
    calls: Array<{ method: string; params: unknown[] }>,
    preferredRpc?: string
): Promise<unknown[]> {
    const rpc = preferredRpc || getPrimaryRpc();
    const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
            calls.map((call, i) => ({
                jsonrpc: '2.0',
                method: call.method,
                params: call.params,
                id: i + 1,
            }))
        ),
    });

    const text = await response.text();
    let results: Array<{ result: unknown }> | { result: unknown };
    try {
        results = JSON.parse(text) as typeof results;
    } catch {
        const ct = response.headers.get('content-type') || '';
        const snippet = text.slice(0, 200);
        throw new Error(`RPC batch returned non-JSON response (status=${response.status}, content-type=${ct}): ${snippet}`);
    }
    if (Array.isArray(results)) {
        const sorted = [...results].sort((a, b) => {
            const aId = (a as { id?: number }).id ?? 0;
            const bId = (b as { id?: number }).id ?? 0;
            return aId - bId;
        });
        return sorted.map(r => (r as { result: unknown }).result);
    }
    return [(results as { result: unknown }).result];
}

export async function ethCall(to: string, data: string): Promise<string> {
    return rpcCall<string>('eth_call', [{ to, data }, 'latest']);
}
