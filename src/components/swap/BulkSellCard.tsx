'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Token, USDC, WSEI } from '@/config/tokens';
import { useBulkSell, BulkSellLeg } from '@/hooks/useBulkSell';
import { useUserBalances } from '@/providers/UserBalanceProvider';
import { useToast } from '@/providers/ToastProvider';
import { TokenSelector } from '@/components/common/TokenSelector';

export function BulkSellCard() {
    const { isConnected, address } = useAccount();
    const { success, error: showError } = useToast();
    const { getBalance } = useUserBalances();
    const { quoteAll, approveAll, executeBulkSell, isQuoting, error } = useBulkSell();

    const [tokenOut, setTokenOut] = useState<Token>(USDC);
    const [legs, setLegs] = useState<BulkSellLeg[]>([]);
    
    // UI states
    const [isInputSelectorOpen, setIsInputSelectorOpen] = useState(false);
    const [isOutputSelectorOpen, setIsOutputSelectorOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Add an input token
    const addToken = useCallback(
        (token: Token) => {
            if (legs.find((l) => l.token.address === token.address)) return;
            setLegs((prev) => [...prev, { token, amountIn: '', status: 'idle' }]);
        },
        [legs],
    );

    // Remove an input token
    const removeToken = useCallback(
        (index: number) => {
            setLegs((prev) => prev.filter((_, i) => i !== index));
        },
        [],
    );

    // Update input amount for a specific leg
    const updateAmount = useCallback(
        (index: number, value: string) => {
            const sanitized = value.replace(/[^0-9.]/g, '');
            if (sanitized.split('.').length > 2) return;
            
            setLegs((prev) => {
                const newLegs = [...prev];
                newLegs[index] = { ...newLegs[index], amountIn: sanitized, status: 'idle' };
                return newLegs;
            });
        },
        [],
    );
    
    // Set max balance for a leg
    const setMaxBalance = useCallback((index: number, token: Token) => {
        const balanceInfo = getBalance(token.address);
        if (balanceInfo && parseFloat(balanceInfo.formatted) > 0) {
            updateAmount(index, balanceInfo.formatted);
        }
    }, [getBalance, updateAmount]);

    // Auto-quote when amounts or legs change
    useEffect(() => {
        if (quoteTimer.current) clearTimeout(quoteTimer.current);
        
        // Only run if at least one leg has an amount
        const hasAmount = legs.some(l => l.amountIn && parseFloat(l.amountIn) > 0);
        if (!hasAmount || legs.length === 0) return;

        quoteTimer.current = setTimeout(async () => {
            const quoted = await quoteAll(legs, tokenOut);
            setLegs(quoted);
        }, 800);

        return () => {
            if (quoteTimer.current) clearTimeout(quoteTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenOut.address, legs.length, legs.map(l => l.token.address + l.amountIn).join(',')]);

    // Handle Execute (Approve + Sell)
    const handleExecute = async () => {
        if (!isConnected || legs.length === 0) return;
        setIsProcessing(true);

        // 1. Approve all native inputs (if needed)
        const approved = await approveAll(legs);
        if (!approved) {
            setIsProcessing(false);
            if (error) showError(error);
            return;
        }

        // 2. Execute Bulk Sell
        const result = await executeBulkSell(legs, tokenOut);
        if (result) {
            success('Bulk sell submitted!');
            setLegs([]);
        } else if (error) {
            showError(error);
        }
        setIsProcessing(false);
    };

    const activeLegs = legs.filter(l => l.amountIn && parseFloat(l.amountIn) > 0);
    const quotedCount = activeLegs.filter((l) => l.status === 'quoted').length;
    const canExecute = isConnected && activeLegs.length > 0 && quotedCount === activeLegs.length && !isQuoting && !isProcessing;

    const totalEstimatedOut = activeLegs.reduce((sum, leg) => {
        return sum + (leg.estimatedOut ? parseFloat(leg.estimatedOut) : 0);
    }, 0);

    return (
        <div className="glass-card p-6 md:p-8 relative overflow-hidden" id="bulk-sell-card">
            {/* Background glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-red-500/10 to-orange-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-br from-pink-500/10 to-rose-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            Bulk Sell
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Sell multiple active positions into one token
                        </p>
                    </div>
                </div>

                {/* Input Legs (What you sell) */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-400">You pay (Sell)</span>
                        <button
                            onClick={() => setIsInputSelectorOpen(true)}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition font-medium"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Token to Sell
                        </button>
                    </div>

                    <div className="space-y-2">
                        {legs.map((leg, i) => {
                            const balanceInfo = getBalance(leg.token.address);
                            const numBal = parseFloat(balanceInfo?.formatted || '0');
                            const hasAmount = leg.amountIn && parseFloat(leg.amountIn) > 0;
                            return (
                                <div
                                    key={leg.token.address}
                                    className="rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all group overflow-hidden"
                                >
                                    {/* Top row: token identity + remove */}
                                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                                                {leg.token.logoURI ? (
                                                    <img src={leg.token.logoURI} alt={leg.token.symbol} className="w-8 h-8 rounded-full" />
                                                ) : (
                                                    <span className="text-sm font-bold text-red-300">{leg.token.symbol[0]}</span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm leading-none">{leg.token.symbol}</p>
                                                {numBal > 0 && (
                                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                                        Bal: {numBal > 1000 ? numBal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : numBal.toFixed(4)}
                                                    </p>
                                                )}
                                            </div>
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

                                    {/* Bottom row: amount input + output estimate */}
                                    <div className="px-4 pb-3 space-y-2">
                                        <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                value={leg.amountIn}
                                                onChange={(e) => updateAmount(i, e.target.value)}
                                                className="flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-gray-600 min-w-0 w-0"
                                            />
                                            {numBal > 0 && (
                                                <button
                                                    onClick={() => setMaxBalance(i, leg.token)}
                                                    className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition shrink-0"
                                                >
                                                    MAX
                                                </button>
                                            )}
                                        </div>

                                        {/* Estimated output — full width below input */}
                                        {(leg.status === 'quoting' || (isQuoting && hasAmount)) ? (
                                            <div className="flex items-center gap-1.5 px-1">
                                                <div className="w-3 h-3 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
                                                <span className="text-xs text-gray-500">Getting quote...</span>
                                            </div>
                                        ) : leg.status === 'quoted' && leg.estimatedOut ? (
                                            <div className="flex items-center justify-between px-1">
                                                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                </svg>
                                                <span className="text-sm font-semibold text-green-400">
                                                    +{parseFloat(leg.estimatedOut).toFixed(4)} <span className="text-xs text-gray-400 font-normal">{tokenOut.symbol}</span>
                                                </span>
                                            </div>
                                        ) : leg.status === 'failed' ? (
                                            <div className="flex items-center gap-1 px-1">
                                                <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-xs text-red-400">No route found</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                        {legs.length === 0 && (
                            <button
                                onClick={() => setIsInputSelectorOpen(true)}
                                className="w-full py-8 rounded-xl border border-dashed border-white/10 hover:border-red-500/30 hover:bg-red-500/5 transition-all flex flex-col items-center gap-2 text-gray-500 hover:text-red-400"
                            >
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-sm font-medium">Select tokens to sell</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Arrow divider */}
                <div className="flex justify-center -my-1 relative z-20">
                    <div className="w-10 h-10 rounded-xl bg-surface-dark border border-white/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>
                </div>

                {/* Output Section (What you get) */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs text-gray-400">You receive</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-2xl font-bold ${totalEstimatedOut > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                                    {totalEstimatedOut > 0
                                        ? (totalEstimatedOut > 1000
                                            ? totalEstimatedOut.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                            : totalEstimatedOut.toFixed(4))
                                        : '0.00'}
                                </span>
                                <span className="text-sm text-gray-400 font-medium">{tokenOut.symbol}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOutputSelectorOpen(true)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 hover:border-white/25 transition font-medium"
                        >
                            {tokenOut.logoURI && (
                                <img src={tokenOut.logoURI} alt={tokenOut.symbol} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{tokenOut.symbol}</span>
                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Execute Button */}
                <button
                    onClick={handleExecute}
                    disabled={!canExecute}
                    className={`w-full mt-6 py-4 rounded-xl font-semibold text-lg transition-all ${
                        canExecute
                            ? 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-red-500/20 text-white'
                            : 'bg-white/5 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {!isConnected
                        ? 'Connect Wallet'
                        : isProcessing
                            ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Approving & Swapping...
                                </span>
                            )
                            : isQuoting
                                ? 'Getting Quotes...'
                                : activeLegs.length === 0
                                    ? 'Enter Amounts to Sell'
                                    : quotedCount === 0
                                        ? 'No Routes Found'
                                        : `Sell ${activeLegs.length} Token${activeLegs.length > 1 ? 's' : ''}`}
                </button>

                {error && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {error}
                    </div>
                )}
            </div>

            <TokenSelector
                isOpen={isInputSelectorOpen}
                onClose={() => setIsInputSelectorOpen(false)}
                onSelect={addToken}
                excludeToken={tokenOut}
                excludeTokens={legs.map(l => l.token)}
                multiSelect
                onMultiSelect={(tokens) => tokens.forEach(addToken)}
            />

            <TokenSelector
                isOpen={isOutputSelectorOpen}
                onClose={() => setIsOutputSelectorOpen(false)}
                onSelect={(token) => setTokenOut(token)}
            />
        </div>
    );
}
