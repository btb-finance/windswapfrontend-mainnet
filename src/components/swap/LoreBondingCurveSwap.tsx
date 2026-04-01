'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Token, ETH, LORE } from '@/config/tokens';
import { sei } from '@/config/chains';
import { useTokenBalance } from '@/hooks/useToken';
import { TokenInput } from './TokenInput';
import { haptic } from '@/hooks/useHaptic';
import { useToast } from '@/providers/ToastProvider';
import {
    useBondingCurveMarketInfo,
    usePreviewSell,
    useLoreAllowanceForBondingCurve,
    useBuyLore,
    useSellLore,
    useApproveLoreForBondingCurve,
} from '@/hooks/useLOREBondingCurve';

interface LoreBondingCurveSwapProps {
    initialTokenIn?: Token;
    initialTokenOut?: Token;
}

function isBuyDirection(tokenIn?: Token): boolean {
    return !tokenIn || tokenIn.address.toLowerCase() !== LORE.address.toLowerCase();
}

/**
 * Simulate the exact math buy() runs on-chain:
 *   - msg.value lands in address(this).balance BEFORE getCurrentPrice() is called
 *   - So price = (seiReserve + seiIn) * 1e18 / circulatingSupply
 *   - boreOut = (seiIn - fee) * 1e18 / price
 *           = (seiIn * (BPS - feeBps) / BPS) * circulatingSupply / (seiReserve + seiIn)
 */
function simulateBuy(
    seiIn: bigint,
    seiReserve: bigint,
    circulatingSupply: bigint,
    feeBps: bigint,
): bigint {
    if (circulatingSupply === BigInt(0) || seiReserve + seiIn === BigInt(0)) return BigInt(0);
    const BPS = BigInt(10000);
    const newReserve = seiReserve + seiIn;
    const actualPrice = (newReserve * BigInt(10) ** BigInt(18)) / circulatingSupply;
    const fee = (seiIn * feeBps) / BPS;
    const seiNet = seiIn - fee;
    return (seiNet * BigInt(10) ** BigInt(18)) / actualPrice;
}

/**
 * For sell() the LORE transfer happens AFTER getCurrentPrice(), so the price
 * doesn't change before calculation — previewSell is accurate. We keep the
 * on-chain preview hook for sell.
 */

export function LoreBondingCurveSwap({ initialTokenIn, initialTokenOut }: LoreBondingCurveSwapProps) {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const isOnSei = chainId === sei.id;
    const { success, error: showError } = useToast();

    const [isBuying, setIsBuying] = useState(() => isBuyDirection(initialTokenIn));
    const [seiAmount, setSeiAmount] = useState('');
    const [loreAmount, setLoreAmount] = useState('');
    const [drivingField, setDrivingField] = useState<'sei' | 'lore'>('sei');

    const { raw: rawEthBalance, formatted: formattedEthBalance } = useTokenBalance(ETH);
    const { raw: rawLoreBalance, formatted: formattedLoreBalance } = useTokenBalance(LORE);

    // Market info — drives both the buy quote and display stats
    const { data: marketInfo, refetch: refetchMarket } = useBondingCurveMarketInfo();

    const seiWei  = seiAmount  && parseFloat(seiAmount)  > 0 ? parseEther(seiAmount)  : undefined;
    const loreWei = loreAmount && parseFloat(loreAmount) > 0 ? parseEther(loreAmount) : undefined;

    // Sell preview uses the contract (price doesn't change before execution)
    const { data: sellPreview } = usePreviewSell(!isBuying ? loreWei : undefined);

    // Buy quote — computed locally to match what buy() actually does on-chain
    const computedBuyLore = useMemo(() => {
        if (!isBuying || !seiWei || !marketInfo) return undefined;
        const seiReserve       = marketInfo[2]; // SEIBacking
        const circulatingSupply = marketInfo[1]; // circulatingSupply
        const feeBps            = marketInfo[4]; // tradingFee
        return simulateBuy(seiWei, seiReserve, circulatingSupply, feeBps);
    }, [isBuying, seiWei, marketInfo]);

    // Update output field from quotes
    useEffect(() => {
        if (isBuying && drivingField === 'sei') {
            if (computedBuyLore !== undefined && computedBuyLore > BigInt(0)) {
                setLoreAmount(formatEther(computedBuyLore));
            } else if (!seiWei) {
                setLoreAmount('');
            }
        }
    }, [computedBuyLore, isBuying, drivingField, seiWei]);

    useEffect(() => {
        if (!isBuying && drivingField === 'lore') {
            if (sellPreview && sellPreview[0] > BigInt(0)) {
                setSeiAmount(formatEther(sellPreview[0]));
            } else if (!loreWei) {
                setSeiAmount('');
            }
        }
    }, [sellPreview, isBuying, drivingField, loreWei]);

    // Allowance (for sell)
    const { data: allowance, refetch: refetchAllowance } = useLoreAllowanceForBondingCurve(address);
    const needsApproval = !isBuying && loreWei !== undefined && loreWei > BigInt(0) &&
        (allowance === undefined || (allowance as bigint) < loreWei);

    // TX state
    const [pendingApprovalHash, setPendingApprovalHash] = useState<`0x${string}` | undefined>();
    const [txHash, setTxHash] = useState<string | null>(null);
    const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({ hash: pendingApprovalHash });

    useEffect(() => {
        if (approvalConfirmed && pendingApprovalHash) {
            refetchAllowance();
            setPendingApprovalHash(undefined);
        }
    }, [approvalConfirmed, pendingApprovalHash, refetchAllowance]);

    const { buy, isPending: isBuying_ } = useBuyLore();
    const { sell, isPending: isSelling } = useSellLore();
    const { approve, isPending: isApproving } = useApproveLoreForBondingCurve();

    const handleFlip = () => {
        setIsBuying(b => !b);
        setSeiAmount('');
        setLoreAmount('');
        setDrivingField('sei');
        setTxHash(null);
    };

    const handleSeiChange = (val: string) => {
        setSeiAmount(val);
        setDrivingField('sei');
        if (!val) setLoreAmount('');
    };

    const handleLoreChange = (val: string) => {
        setLoreAmount(val);
        setDrivingField('lore');
        if (!val) setSeiAmount('');
    };

    const handleApprove = async () => {
        if (!loreWei) return;
        haptic('medium');
        try {
            const hash = await approve(loreWei);
            setPendingApprovalHash(hash);
        } catch (err: unknown) {
            showError((err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : undefined) || 'Approval failed');
        }
    };

    const handleSwap = async () => {
        haptic('medium');
        try {
            let hash: `0x${string}`;
            if (isBuying) {
                if (!seiWei) return;
                hash = await buy(seiWei) as `0x${string}`;
            } else {
                if (!loreWei) return;
                hash = await sell(loreWei) as `0x${string}`;
            }
            setTxHash(hash);
            setSeiAmount('');
            setLoreAmount('');
            refetchMarket();
            success(`${isBuying ? 'Buy' : 'Sell'} successful!`);
        } catch (err: unknown) {
            showError((err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : undefined) || 'Transaction failed');
        }
    };

    // Display values
    const feeBps = marketInfo ? marketInfo[4] : undefined;
    const feePercent = feeBps !== undefined ? (Number(feeBps) / 100).toFixed(1) : null;

    // Show the execution price (reserve + seiIn as the contract uses) not the current price
    const executionPrice = useMemo(() => {
        if (!isBuying || !seiWei || !marketInfo) return marketInfo ? marketInfo[0] : undefined;
        const newReserve = marketInfo[2] + seiWei;
        const circ = marketInfo[1];
        if (circ === BigInt(0)) return BigInt(0);
        return (newReserve * BigInt(10) ** BigInt(18)) / circ;
    }, [isBuying, seiWei, marketInfo]);

    const priceFormatted = executionPrice && executionPrice > BigInt(0)
        ? Number(formatEther(executionPrice)).toFixed(8)
        : null;

    // Fee amount to display
    const feeAmount = useMemo(() => {
        if (isBuying && seiWei && feeBps !== undefined) {
            const fee = (seiWei * feeBps) / BigInt(10000);
            return formatEther(fee);
        }
        if (!isBuying && loreWei && sellPreview) {
            const fee = sellPreview[2]; // fee from previewSell
            return formatEther(fee);
        }
        return null;
    }, [isBuying, seiWei, loreWei, feeBps, sellPreview]);

    const canSwap = isConnected && isOnSei && (
        isBuying
            ? (seiWei !== undefined && seiWei > BigInt(0))
            : (loreWei !== undefined && loreWei > BigInt(0))
    );

    const tokenIn  = isBuying ? ETH  : LORE;
    const tokenOut = isBuying ? LORE : ETH;
    const amountIn  = isBuying ? seiAmount  : loreAmount;
    const amountOut = isBuying ? loreAmount : seiAmount;
    const balanceIn    = isBuying ? formattedEthBalance  : formattedLoreBalance;
    const rawBalanceIn = isBuying ? rawEthBalance        : rawLoreBalance;
    const balanceOut   = isBuying ? formattedLoreBalance : formattedEthBalance;

    return (
        <div className="swap-card max-w-md mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold">Swap</h2>
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                        Bonding Curve
                    </span>
                </div>
                {feePercent && (
                    <span className="text-xs text-foreground/50">Fee: {feePercent}%</span>
                )}
            </div>

            {/* Chain warning */}
            {isConnected && !isOnSei && (
                <div className="mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs flex items-center justify-between">
                    <span>Switch to Sei to trade</span>
                    <button onClick={() => switchChain({ chainId: sei.id })} className="btn-primary text-xs py-1 px-2">
                        Switch
                    </button>
                </div>
            )}

            {/* Success */}
            {txHash && (
                <div className="mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                    Success!{' '}
                    <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">
                        View →
                    </a>
                </div>
            )}

            {/* Token In */}
            <TokenInput
                label="You pay"
                token={tokenIn}
                amount={amountIn}
                balance={balanceIn}
                rawBalance={rawBalanceIn}
                onAmountChange={isBuying ? handleSeiChange : handleLoreChange}
                onTokenSelect={() => {}}
                showMaxButton
            />

            {/* Flip button */}
            <div className="relative h-0 flex items-center justify-center z-10">
                <motion.button
                    onClick={handleFlip}
                    className="swap-arrow-btn"
                    aria-label="Flip direction"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                </motion.button>
            </div>

            {/* Token Out */}
            <TokenInput
                label="You receive"
                token={tokenOut}
                amount={amountOut}
                balance={balanceOut}
                onAmountChange={isBuying ? handleLoreChange : handleSeiChange}
                onTokenSelect={() => {}}
            />

            {/* Rate / Fee info */}
            {(priceFormatted || feeAmount) && (
                <div className="mt-3 p-2 rounded-lg bg-white/5 text-xs space-y-1">
                    {priceFormatted && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">
                                {isBuying && seiWei ? 'Execution price' : 'Current price'}
                            </span>
                            <span>1 LORE = {priceFormatted} ETH</span>
                        </div>
                    )}
                    {feeAmount && parseFloat(feeAmount) > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">Fee ({feePercent}%)</span>
                            <span className="text-foreground/70">
                                {parseFloat(feeAmount).toFixed(6)} {isBuying ? 'ETH' : 'ETH'}
                            </span>
                        </div>
                    )}
                    {marketInfo && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-gray-400">ETH Backing</span>
                                <span>{Number(formatEther(marketInfo[2])).toLocaleString(undefined, { maximumFractionDigits: 2 })} ETH</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Circulating Supply</span>
                                <span>{Number(formatEther(marketInfo[1])).toLocaleString(undefined, { maximumFractionDigits: 0 })} LORE</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Action Button */}
            {!isConnected ? (
                <button disabled className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50">
                    Connect Wallet
                </button>
            ) : !isOnSei ? (
                <button onClick={() => switchChain({ chainId: sei.id })} className="w-full btn-primary py-4 text-base mt-4">
                    Switch to Sei
                </button>
            ) : needsApproval ? (
                <button
                    onClick={handleApprove}
                    disabled={isApproving || !!pendingApprovalHash}
                    className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
                >
                    {isApproving || pendingApprovalHash ? 'Approving...' : 'Approve LORE'}
                </button>
            ) : (
                <button
                    onClick={handleSwap}
                    disabled={!canSwap || isBuying_ || isSelling}
                    className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
                >
                    {isBuying_ || isSelling
                        ? 'Swapping...'
                        : !canSwap
                        ? 'Enter Amount'
                        : isBuying
                        ? 'Buy LORE'
                        : 'Sell LORE'}
                </button>
            )}

            <div className="mt-3 text-center text-[10px] text-gray-500">
                Trades via LOREBondingCurve · Price increases with demand
            </div>
        </div>
    );
}
