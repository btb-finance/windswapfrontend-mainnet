'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SwapInterface } from '@/components/swap/SwapInterface';
import { BulkSwapCard } from '@/components/swap/BulkSwapCard';
import { BulkSellCard } from '@/components/swap/BulkSellCard';
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
    
    // Toggle state: 'single' | 'bulk-buy' | 'bulk-sell'
    const [swapMode, setSwapMode] = useState<'single' | 'bulk-buy' | 'bulk-sell'>('single');

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
    }, [searchParams]); // re-run if URL logic is used later

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
        <div className="max-w-xl mx-auto">
            {/* Mode Toggle */}
            <div className="flex justify-center mb-6">
                <div className="inline-flex rounded-xl bg-surface-dark border border-white/10 p-1">
                    <button
                        onClick={() => setSwapMode('single')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                            swapMode === 'single'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        Single Swap
                    </button>
                    <button
                        onClick={() => setSwapMode('bulk-buy')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                            swapMode === 'bulk-buy'
                                ? 'bg-white/10 text-indigo-400 shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        Bulk Buy
                    </button>
                    <button
                        onClick={() => setSwapMode('bulk-sell')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                            swapMode === 'bulk-sell'
                                ? 'bg-white/10 text-red-400 shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        Bulk Sell
                    </button>
                </div>
            </div>

            {/* Content properly centered with matching max-widths */}
            {swapMode === 'single' && (
                <div className="max-w-md mx-auto">
                    <SwapInterface
                        initialTokenIn={initialTokenIn}
                        initialTokenOut={initialTokenOut}
                        onTokenPairChange={handleTokenChange}
                    />
                </div>
            )}
            {swapMode === 'bulk-buy' && (
                <div className="w-full">
                    <BulkSwapCard />
                </div>
            )}
            {swapMode === 'bulk-sell' && (
                <div className="w-full">
                    <BulkSellCard />
                </div>
            )}
        </div>
    );
}

export default function SwapPage() {
    return (
        <div className="container mx-auto px-3 sm:px-6 py-8">
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
