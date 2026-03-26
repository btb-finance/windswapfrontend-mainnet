'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SwapInterface } from '@/components/swap/SwapInterface';
import { getTokenByAddress } from '@/utils/tokens';
import { Token } from '@/config/tokens';
import { getRpcForPoolData } from '@/utils/rpc';
import { getAddress } from 'viem';

async function fetchTokenFromChain(address: string): Promise<Token | null> {
    try {
        const checksumAddr = getAddress(address);
        const rpc = getRpcForPoolData();
        const calls = ['0x95d89b41', '0x06fdde03', '0x313ce567'].map((data, id) =>
            fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: checksumAddr, data }, 'latest'], id }),
            }).then(r => r.json())
        );
        const [symRes, nameRes, decRes] = await Promise.all(calls);
        const decode = (hex: string) => {
            if (!hex || hex === '0x' || hex.length < 130) return '';
            const len = parseInt(hex.slice(66, 130), 16);
            return Buffer.from(hex.slice(130, 130 + len * 2), 'hex').toString('utf8').replace(/\0/g, '').trim();
        };
        const symbol = decode(symRes.result);
        if (!symbol) return null;
        const name = decode(nameRes.result) || symbol;
        const decimals = decRes.result ? parseInt(decRes.result, 16) : 18;
        return { address: checksumAddr as `0x${string}`, symbol, name, decimals };
    } catch { return null; }
}

function SwapWithParams() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [initialTokenIn, setInitialTokenIn] = useState<Token | undefined>();
    const [initialTokenOut, setInitialTokenOut] = useState<Token | undefined>();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const tokenInAddress = searchParams.get('tokenIn');
        const tokenOutAddress = searchParams.get('tokenOut');

        const resolve = async (addr: string | null): Promise<Token | undefined> => {
            if (!addr) return undefined;
            const known = getTokenByAddress(addr);
            if (known) return known;
            const fetched = await fetchTokenFromChain(addr);
            return fetched ?? undefined;
        };

        Promise.all([resolve(tokenInAddress), resolve(tokenOutAddress)]).then(([tIn, tOut]) => {
            setInitialTokenIn(tIn);
            setInitialTokenOut(tOut);
            setReady(true);
        });
    }, []); // only on mount — URL params are initial state

    const handleTokenChange = (tokenIn?: Token, tokenOut?: Token) => {
        const params = new URLSearchParams();
        if (tokenIn) params.set('tokenIn', tokenIn.address);
        if (tokenOut) params.set('tokenOut', tokenOut.address);
        router.replace(`/swap?${params.toString()}`, { scroll: false });
    };

    if (!ready) return (
        <div className="swap-card max-w-md mx-auto p-8 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
    );

    return (
        <SwapInterface
            initialTokenIn={initialTokenIn}
            initialTokenOut={initialTokenOut}
            onTokenPairChange={handleTokenChange}
        />
    );
}

export default function SwapPage() {
    return (
        <div className="container mx-auto px-3 sm:px-6 py-4">
            <Suspense fallback={
                <div className="swap-card max-w-md mx-auto p-8 text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            }>
                <SwapWithParams />
            </Suspense>
        </div>
    );
}
