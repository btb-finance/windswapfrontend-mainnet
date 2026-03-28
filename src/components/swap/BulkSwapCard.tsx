'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { Token, SEI, USDC, DEFAULT_TOKEN_LIST } from '@/config/tokens';
import { useBulkSwap, BulkSwapLeg } from '@/hooks/useBulkSwap';
import { useTokenBalance } from '@/hooks/useToken';
import { useToast } from '@/providers/ToastProvider';
import { formatUnits, parseUnits } from 'viem';
import { TokenSelector } from '@/components/common/TokenSelector';
import { getRpcForPoolData } from '@/utils/rpc';
import { getTokenMetadataFromCache, setTokenMetadataCache } from '@/utils/cache';

const isValidAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

async function resolveToken(address: string): Promise<Token | null> {
    const lower = address.toLowerCase();
    const known = DEFAULT_TOKEN_LIST.find(t => t.address.toLowerCase() === lower);
    if (known) return known;
    try {
        const cached = getTokenMetadataFromCache(address);
        if (cached) return { address: address as `0x${string}`, ...cached };
        const decode = (hex: string) => {
            if (!hex || hex === '0x' || hex.length < 130) return '';
            const len = parseInt(hex.slice(66, 130), 16);
            return Buffer.from(hex.slice(130, 130 + len * 2), 'hex').toString('utf8').replace(/\0/g, '').trim();
        };
        const rpc = getRpcForPoolData();
        const call = (data: string, id: number) => fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: address, data }, 'latest'], id }),
        }).then(r => r.json());
        const [sym, name, dec] = await Promise.all([call('0x95d89b41', 1), call('0x06fdde03', 2), call('0x313ce567', 3)]);
        const symbol = decode(sym.result);
        if (!symbol) return null;
        const decimals = dec.result ? parseInt(dec.result, 16) : 18;
        const nameStr = decode(name.result) || symbol;
        setTokenMetadataCache(address, { symbol, name: nameStr, decimals });
        return { address: address as `0x${string}`, symbol, name: nameStr, decimals };
    } catch { return null; }
}


export function BulkSwapCard() {
    const { isConnected, address } = useAccount();
    const { success, error: showError } = useToast();
    const { quoteAll, executeBulkSwap, isQuoting, isExecuting, error } = useBulkSwap();
    const searchParams = useSearchParams();

    const [tokenIn, setTokenIn] = useState<Token>(SEI);
    const [amountIn, setAmountIn] = useState('');
    const [legs, setLegs] = useState<BulkSwapLeg[]>([]);
    const [shareCopied, setShareCopied] = useState(false);
    const [isShareSelectorOpen, setIsShareSelectorOpen] = useState(false);

    const [isInputSelectorOpen, setIsInputSelectorOpen] = useState(false);
    const [isOutputSelectorOpen, setIsOutputSelectorOpen] = useState(false);

    const { formatted: balanceIn } = useTokenBalance(tokenIn);
    const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load tokens from URL param on mount (?tokens=addr1,addr2,...)
    useEffect(() => {
        const param = searchParams.get('tokens');
        if (!param) return;
        const addresses = param.split(',').filter(isValidAddress);
        if (addresses.length === 0) return;
        Promise.all(addresses.map(resolveToken)).then(results => {
            const resolved = results.filter((t): t is Token => t !== null);
            if (resolved.length === 0) return;
            const alloc = 1 / resolved.length;
            setLegs(resolved.map(token => ({ token, allocation: alloc, status: 'idle' as const })));
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Copy shareable URL for selected tokens
    const handleShareTokens = useCallback((tokens: Token[]) => {
        if (tokens.length === 0) return;
        const addrs = tokens.map(t => t.address).join(',');
        const url = `${window.location.origin}/swap?mode=bulk-buy&tokens=${addrs}`;
        navigator.clipboard.writeText(url).then(() => {
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        }).catch(() => {});
    }, []);

    // Add a token
    const addToken = useCallback(
        (token: Token) => {
            if (legs.find((l) => l.token.address === token.address)) return;
            const newLegs = [...legs, { token, allocation: 0, status: 'idle' as const }];
            // Re-distribute equally
            const alloc = 1 / newLegs.length;
            setLegs(newLegs.map((l) => ({ ...l, allocation: alloc })));
            setIsOutputSelectorOpen(false);
        },
        [legs],
    );

    // Remove a token
    const removeToken = useCallback(
        (index: number) => {
            const newLegs = legs.filter((_, i) => i !== index);
            if (newLegs.length === 0) {
                setLegs([]);
                return;
            }
            const alloc = 1 / newLegs.length;
            setLegs(newLegs.map((l) => ({ ...l, allocation: alloc })));
        },
        [legs],
    );

    // Update allocation for a specific leg
    const updateAllocation = useCallback(
        (index: number, value: number) => {
            const newLegs = [...legs];
            newLegs[index] = { ...newLegs[index], allocation: value };
            // Normalize remaining
            const others = newLegs.filter((_, i) => i !== index);
            const remaining = 1 - value;
            const othersTotal = others.reduce((s, l) => s + l.allocation, 0);
            if (othersTotal > 0) {
                for (let i = 0; i < newLegs.length; i++) {
                    if (i !== index) {
                        newLegs[i] = {
                            ...newLegs[i],
                            allocation: (newLegs[i].allocation / othersTotal) * remaining,
                        };
                    }
                }
            }
            setLegs(newLegs);
        },
        [legs],
    );

    // Auto-quote when amount or legs change
    useEffect(() => {
        if (quoteTimer.current) clearTimeout(quoteTimer.current);
        if (!amountIn || parseFloat(amountIn) <= 0 || legs.length === 0) return;

        quoteTimer.current = setTimeout(async () => {
            const quoted = await quoteAll(tokenIn, amountIn, legs);
            setLegs(quoted);
        }, 800);

        return () => {
            if (quoteTimer.current) clearTimeout(quoteTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amountIn, tokenIn, legs.length, legs.map((l) => l.token.address + l.allocation).join(',')]);

    // Handle execute — skip failed legs automatically
    const handleExecute = async () => {
        if (!isConnected || !amountIn || legs.length === 0) return;
        const executableLegs = legs.filter((l) => l.status !== 'failed');
        if (executableLegs.length === 0) return;
        const result = await executeBulkSwap(tokenIn, amountIn, executableLegs);
        if (result) {
            success('Bulk swap submitted!');
            setAmountIn('');
            setLegs((prev) => prev.map((l) => ({ ...l, status: 'idle', estimatedOut: undefined, routeSummary: undefined })));
        } else if (error) {
            showError(error);
        }
    };

    const failedCount = legs.filter((l) => l.status === 'failed').length;
    const quotedCount = legs.filter((l) => l.status === 'quoted').length;
    const executableLegsCount = legs.length - failedCount;
    const canExecute = isConnected && executableLegsCount > 0 && quotedCount === executableLegsCount && !isQuoting && !isExecuting;

    return (
        <div className="glass-card p-6 md:p-8 relative overflow-hidden" id="bulk-swap-card">
            {/* Background glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            Bulk Swap
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Split one token into multiple in a single transaction
                        </p>
                    </div>
                    <button
                        onClick={() => setIsShareSelectorOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-xs font-medium text-sky-300 hover:bg-sky-500/25 transition-all active:scale-95 shrink-0"
                        title="Create a shareable basket link"
                    >
                        {shareCopied ? (
                            <>
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Link copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                                </svg>
                                Create basket to share
                            </>
                        )}
                    </button>
                </div>


                {/* Input Section */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">You pay</span>
                        {balanceIn && (
                            <button
                                onClick={() => setAmountIn(balanceIn)}
                                className="text-xs text-gray-400 hover:text-white transition"
                            >
                                Balance: {parseFloat(balanceIn).toFixed(4)}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.0"
                            value={amountIn}
                            onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9.]/g, '');
                                if (v.split('.').length <= 2) setAmountIn(v);
                            }}
                            className="flex-1 min-w-0 bg-transparent text-2xl font-semibold outline-none placeholder:text-gray-600"
                            id="bulk-swap-amount-input"
                        />
                        {/* Token selector dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsInputSelectorOpen(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 transition font-medium shrink-0"
                            >
                                {tokenIn.logoURI && (
                                    <img src={tokenIn.logoURI} alt={tokenIn.symbol} className="w-5 h-5 rounded-full" />
                                )}
                                {tokenIn.symbol}
                                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Arrow divider */}
                <div className="flex justify-center -my-1 relative z-20">
                    <div className="w-10 h-10 rounded-xl bg-surface-dark border border-white/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>
                </div>

                {/* Output Legs */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mt-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-400">You receive</span>
                        <button
                            onClick={() => setIsOutputSelectorOpen(true)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Token
                        </button>
                    </div>

                    {/* Leg rows */}
                    <div className="space-y-2">
                        {legs.map((leg, i) => (
                            <div
                                key={leg.token.address}
                                className="rounded-xl bg-white/[0.04] border border-white/[0.08] group hover:border-white/15 transition-all overflow-hidden"
                            >
                                {/* Top: token + remove */}
                                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center overflow-hidden shrink-0">
                                            {leg.token.logoURI
                                                ? <img src={leg.token.logoURI} alt={leg.token.symbol} className="w-7 h-7 rounded-full" />
                                                : <span className="text-xs font-bold text-indigo-300">{leg.token.symbol[0]}</span>
                                            }
                                        </div>
                                        <span className="font-semibold text-sm">{leg.token.symbol}</span>
                                    </div>
                                    <button
                                        onClick={() => removeToken(i)}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition opacity-0 group-hover:opacity-100"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Bottom: slider + allocation % + estimated out */}
                                <div className="px-3 pb-3 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={Math.round(leg.allocation * 100)}
                                            onChange={(e) => updateAllocation(i, parseInt(e.target.value) / 100)}
                                            className="flex-1 h-1.5 rounded-full accent-indigo-500 cursor-pointer min-w-0"
                                        />
                                        <span className="text-xs text-gray-300 font-mono w-9 text-right shrink-0">
                                            {Math.round(leg.allocation * 100)}%
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-end min-h-[18px]">
                                        {leg.status === 'quoting' || isQuoting ? (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                                                <span className="text-xs text-gray-500">quoting</span>
                                            </div>
                                        ) : leg.status === 'quoted' && leg.estimatedOut ? (
                                            <span className="text-sm font-semibold text-green-400">
                                                ≈ {parseFloat(leg.estimatedOut).toFixed(4)} <span className="text-xs text-gray-400 font-normal">{leg.token.symbol}</span>
                                            </span>
                                        ) : leg.status === 'failed' ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-500 border border-gray-500/20">
                                                No route · skipped
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {legs.length === 0 && (
                        <div className="text-center py-6 text-gray-500 text-sm">
                            Add tokens above to start building your swap
                        </div>
                    )}
                </div>

                {/* Fee info */}
                <div className="flex items-center justify-between mt-3 px-1 text-xs text-gray-500">
                    <span>Protocol fee: 1%</span>
                    <span>
                        {quotedCount > 0
                            ? `${quotedCount}/${legs.length} routes found`
                            : legs.length > 0
                                ? 'Enter amount to get quotes'
                                : ''}
                    </span>
                </div>

                {/* Execute Button */}
                <button
                    onClick={handleExecute}
                    disabled={!canExecute}
                    className={`w-full mt-4 py-4 rounded-xl font-semibold text-lg transition-all ${
                        canExecute
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-indigo-500/20'
                            : 'bg-white/5 text-gray-500 cursor-not-allowed'
                    }`}
                    id="bulk-swap-execute-btn"
                >
                    {!isConnected
                        ? 'Connect Wallet'
                        : isExecuting
                            ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Swapping...
                                </span>
                            )
                            : isQuoting
                                ? 'Getting Quotes...'
                                : legs.length === 0
                                    ? 'Select Tokens'
                                    : quotedCount === 0
                                        ? 'Enter Amount'
                                        : failedCount > 0
                                            ? `Swap into ${quotedCount} Token${quotedCount > 1 ? 's' : ''} (${failedCount} skipped)`
                                            : `Swap into ${quotedCount} Token${quotedCount > 1 ? 's' : ''}`}
                </button>

                {/* Error display */}
                {error && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {error}
                    </div>
                )}
            </div>

            <TokenSelector
                isOpen={isInputSelectorOpen}
                onClose={() => setIsInputSelectorOpen(false)}
                onSelect={setTokenIn}
                selectedToken={tokenIn}
            />

            <TokenSelector
                isOpen={isOutputSelectorOpen}
                onClose={() => setIsOutputSelectorOpen(false)}
                onSelect={(token) => addToken(token)}
                excludeToken={tokenIn}
                excludeTokens={legs.map(l => l.token)}
                multiSelect
                onMultiSelect={(tokens) => {
                    setLegs((prev) => {
                        const toAdd = tokens.filter(t => !prev.some(l => l.token.address === t.address));
                        if (toAdd.length === 0) return prev;
                        const newLegs = [...prev, ...toAdd.map(t => ({ token: t, allocation: 0, status: 'idle' as const }))];
                        const alloc = 1 / newLegs.length;
                        return newLegs.map(l => ({ ...l, allocation: alloc }));
                    });
                    setIsOutputSelectorOpen(false);
                }}
            />

            {/* Share basket — pick any tokens → copy link */}
            <TokenSelector
                isOpen={isShareSelectorOpen}
                onClose={() => setIsShareSelectorOpen(false)}
                onSelect={(token) => { handleShareTokens([token]); setIsShareSelectorOpen(false); }}
                excludeToken={tokenIn}
                multiSelect
                onMultiSelect={(tokens) => { handleShareTokens(tokens); setIsShareSelectorOpen(false); }}
            />
        </div>
    );
}
