'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { parseUnits, formatUnits, Address, maxUint256, encodeFunctionData } from 'viem';
import { Token, ETH, USDC, WETH, LORE } from '@/config/tokens';
import { LoreBondingCurveSwap } from './LoreBondingCurveSwap';
import { V2_CONTRACTS, CL_CONTRACTS, COMMON } from '@/config/contracts';
import { ROUTER_ABI, ERC20_ABI, SWAP_ROUTER_ABI, WETH_ABI, AGGREGATOR_PROXY_ABI } from '@/config/abis';
import { TokenInput } from './TokenInput';
import { SwapSettings } from './SwapSettings';
import { useSwap } from '@/hooks/useSwap';
import { useSwapV3 } from '@/hooks/useSwapV3';
import { useTokenBalance } from '@/hooks/useToken';
import { useMixedRouteQuoter } from '@/hooks/useMixedRouteQuoter';
import { useBatchTransactions } from '@/hooks/useBatchTransactions';
import { haptic } from '@/hooks/useHaptic';
import { SLIPPAGE, DEBOUNCE_MS, ACCESSIBILITY } from '@/config/constants';
import { getSwapErrorMessage, isUserRejection } from '@/utils/errors';
import { getDeadline } from '@/utils/format';
import { useToast } from '@/providers/ToastProvider';
import { getWowMaxQuote, getWowMaxSwapData } from '@/utils/wowmax';
import { getKyberQuote, getKyberSwapData } from '@/utils/kyberswap';

interface Route {
    from: Address;
    to: Address;
    stable: boolean;
    factory: Address;
}

interface BestRoute {
    type: 'v2' | 'v3' | 'multi-hop' | 'wrap' | 'split' | 'wowmax' | 'kyberswap';
    kyberRouteSummary?: object;
    amountOut: string;
    tickSpacing?: number;
    tickSpacing1?: number;
    tickSpacing2?: number;
    feeLabel: string;
    stable?: boolean;
    via?: string;
    intermediate?: Token;
    isWrap?: boolean;
    amountInComputed?: string;
    splitLegs?: {
        amountIn: string;
        amountOut: string;
        percent: number;
        routeType: 'direct' | 'multi-hop';
        tickSpacing1: number;
        tickSpacing2?: number;
        intermediate?: Token;
        label: string;
    }[];
}

interface SwapInterfaceProps {
    initialTokenIn?: Token;
    initialTokenOut?: Token;
    onTokenPairChange?: (tokenIn?: Token, tokenOut?: Token) => void;
}

interface SwapInterfaceInnerProps extends SwapInterfaceProps {
    onTokenInChange: (t: Token) => void;
    onTokenOutChange: (t: Token) => void;
}

const LORE_ADDRESS_LOWER = LORE.address.toLowerCase();

function isLoreToken(t?: Token): boolean {
    return !!t && t.address.toLowerCase() === LORE_ADDRESS_LOWER;
}

// Public entry point — owns tokenIn/tokenOut routing state, no other hooks
export function SwapInterface({ initialTokenIn, initialTokenOut, onTokenPairChange }: SwapInterfaceProps) {
    const [tokenIn, setTokenIn] = useState<Token | undefined>(initialTokenIn || ETH);
    const [tokenOut, setTokenOut] = useState<Token | undefined>(initialTokenOut || USDC);

    const handleTokenInChange = useCallback((t: Token) => {
        setTokenIn(t);
        onTokenPairChange?.(t, tokenOut);
    }, [tokenOut, onTokenPairChange]);

    const handleTokenOutChange = useCallback((t: Token) => {
        setTokenOut(t);
        onTokenPairChange?.(tokenIn, t);
    }, [tokenIn, onTokenPairChange]);

    if (isLoreToken(tokenIn) || isLoreToken(tokenOut)) {
        return <LoreBondingCurveSwap initialTokenIn={tokenIn} initialTokenOut={tokenOut} />;
    }
    return (
        <SwapInterfaceInner
            initialTokenIn={tokenIn}
            initialTokenOut={tokenOut}
            onTokenInChange={handleTokenInChange}
            onTokenOutChange={handleTokenOutChange}
        />
    );
}

function SwapInterfaceInner({ initialTokenIn, initialTokenOut, onTokenInChange, onTokenOutChange }: SwapInterfaceInnerProps) {
    const { isConnected, address } = useAccount();
    const { success, error: showError } = useToast();

    // Token state — local copy; changes bubble up via callbacks so parent can re-route to bonding curve
    const [tokenIn, setTokenIn] = useState<Token | undefined>(initialTokenIn || ETH);
    const [tokenOut, setTokenOut] = useState<Token | undefined>(initialTokenOut || USDC);

    const handleSetTokenIn = useCallback((t: Token) => {
        setTokenIn(t);
        onTokenInChange(t);
    }, [onTokenInChange]);

    const handleSetTokenOut = useCallback((t: Token) => {
        setTokenOut(t);
        onTokenOutChange(t);
    }, [onTokenOutChange]);

    const [amountIn, setAmountIn] = useState('');
    const [amountOut, setAmountOut] = useState('');

    // Best route (auto-detected)
    const [bestRoute, setBestRoute] = useState<BestRoute | null>(null);
    const [isQuoting, setIsQuoting] = useState(false);
    const [noRouteFound, setNoRouteFound] = useState(false);
    const [quoteRefreshTick, setQuoteRefreshTick] = useState(0);

    // Track which field user is typing in
    const [independentField, setIndependentField] = useState<'INPUT' | 'OUTPUT'>('INPUT');
    const [typedValue, setTypedValue] = useState('');

    // Settings state
    const [slippage, setSlippage] = useState<number>(SLIPPAGE.DEFAULT);
    const [deadline, setDeadline] = useState<number>(30);
    const [slippageError, setSlippageError] = useState<string | null>(null);

    // Price impact & high-impact acknowledgment
    const [priceImpactAccepted, setPriceImpactAccepted] = useState(false);

    // UI state
    const [txHash, setTxHash] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [routeLocked, setRouteLocked] = useState(false); // Lock route during approval/swap
    const [error, setError] = useState<string | null>(null);

    // Hooks
    const { executeSwap, getQuoteExactOutput, isLoading: isLoadingV2, error: errorV2 } = useSwap();
    const { getQuoteV3, getQuoteExactOutputV3, executeSwapV3, executeMultiHopSwapV3, executeSplitSwapV3, isLoading: isLoadingV3, error: errorV3 } = useSwapV3();
    const { findOptimalRoute, getSpotRate, getIntermediateToken } = useMixedRouteQuoter();
    const { raw: rawBalanceIn, formatted: formattedBalanceIn } = useTokenBalance(tokenIn);
    const { formatted: formattedBalanceOut } = useTokenBalance(tokenOut);
    const { writeContractAsync } = useWriteContract();
    const { batchOrSequential, encodeApproveCall, encodeContractCall, isLoading: isBatching } = useBatchTransactions();

    const [isSwappingWowmax, setIsSwappingWowmax] = useState(false);
    const isLoading = isLoadingV2 || isLoadingV3 || isBatching || isSwappingWowmax;
    const hookError = errorV2 || errorV3;

    // Get actual token addresses (use WETH for native SEI)
    const actualTokenIn = tokenIn?.isNative ? WETH : tokenIn;
    const actualTokenOut = tokenOut?.isNative ? WETH : tokenOut;

    // Calculate amountInWei for allowance check
    const amountInWei = actualTokenIn && amountIn && parseFloat(amountIn) > 0
        ? parseUnits(amountIn, actualTokenIn.decimals)
        : BigInt(0);

    // ===== Pre-check allowance for ALL routers =====
    const { data: allowanceV2, refetch: refetchAllowanceV2 } = useReadContract({
        address: actualTokenIn?.address as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && actualTokenIn ? [address, V2_CONTRACTS.Router as Address] : undefined,
        query: {
            enabled: !!address && !!actualTokenIn && !tokenIn?.isNative,
        },
    });

    const { data: allowanceV3, refetch: refetchAllowanceV3 } = useReadContract({
        address: actualTokenIn?.address as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && actualTokenIn ? [address, CL_CONTRACTS.SwapRouter as Address] : undefined,
        query: {
            enabled: !!address && !!actualTokenIn && !tokenIn?.isNative,
        },
    });

    const { data: allowanceProxy, refetch: refetchAllowanceProxy } = useReadContract({
        address: actualTokenIn?.address as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && actualTokenIn ? [address, V2_CONTRACTS.AggregatorProxy as Address] : undefined,
        query: {
            enabled: !!address && !!actualTokenIn && !tokenIn?.isNative,
        },
    });

    // Determine which router to use based on best route type
    const routerToApprove = bestRoute?.type === 'v2'
        ? V2_CONTRACTS.Router
        : CL_CONTRACTS.SwapRouter;

    // Get the relevant allowance based on best route
    const currentAllowance = bestRoute?.type === 'v2' ? allowanceV2 : allowanceV3;

    // Check if approval is needed for the CURRENT best route
    // WowMax handles approval inline during swap execution
    const needsApproval = !tokenIn?.isNative &&
        amountInWei > BigInt(0) &&
        bestRoute !== null &&
        bestRoute.type !== 'wrap' &&
        bestRoute.type !== 'wowmax' &&
        bestRoute.type !== 'kyberswap' &&
        (currentAllowance === undefined || (currentAllowance as bigint) < amountInWei);

    // Track pending approval transaction hash
    const [pendingApprovalHash, setPendingApprovalHash] = useState<`0x${string}` | undefined>(undefined);

    // Track if we should auto-swap after approval
    const [autoSwapAfterApproval, setAutoSwapAfterApproval] = useState(false);

    // Wait for approval transaction receipt
    const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({
        hash: pendingApprovalHash,
    });

    // When approval is confirmed, refetch allowances and auto-trigger swap
    useEffect(() => {
        if (approvalConfirmed && pendingApprovalHash) {
            // Refetch both allowances to be safe
            refetchAllowanceV2();
            refetchAllowanceV3();
            setPendingApprovalHash(undefined);
            setIsApproving(false);

            // Auto-trigger swap if flag is set
            if (autoSwapAfterApproval) {
                setAutoSwapAfterApproval(false);
                // Small delay to ensure allowance is updated
                setTimeout(() => {
                    // Trigger swap - the handleSwap will be called via the swapTrigger state
                    setSwapTrigger(prev => prev + 1);
                }, 100);
            }
        }
    }, [approvalConfirmed, pendingApprovalHash, refetchAllowanceV2, refetchAllowanceV3, autoSwapAfterApproval]);

    // Swap trigger state - increment to trigger swap
    const [swapTrigger, setSwapTrigger] = useState(0);

    // Handle approve and then auto-swap (tries EIP-5792 batch first)
    const handleApproveAndSwap = async () => {
        if (!actualTokenIn || !actualTokenOut || !address || !bestRoute) return;

        setRouteLocked(true);
        setIsApproving(true);

        // Calculate amounts for swap
        const amountOutMinWei = actualTokenOut
            ? parseUnits((parseFloat(amountOut) * (1 - slippage / 100)).toFixed(6), actualTokenOut.decimals)
            : BigInt(0);
        const deadlineTimestamp = getDeadline(deadline);

        try {
            // Build the swap call based on route type
            let swapCall;

            if (bestRoute.type === 'v2') {
                // V2 swap
                const route = [{
                    from: (tokenIn?.isNative ? COMMON.WETH : actualTokenIn.address) as Address,
                    to: (tokenOut?.isNative ? COMMON.WETH : actualTokenOut.address) as Address,
                    stable: bestRoute.stable || false,
                    factory: V2_CONTRACTS.PoolFactory as Address,
                }];

                if (tokenIn?.isNative) {
                    // Native SEI to token - no approval needed, can't batch
                    setIsApproving(false);
                    setAutoSwapAfterApproval(false);
                    await handleSwap();
                    return;
                }

                swapCall = encodeContractCall(
                    V2_CONTRACTS.Router as Address,
                    ROUTER_ABI,
                    tokenOut?.isNative ? 'swapExactTokensForETH' : 'swapExactTokensForTokens',
                    [amountInWei, amountOutMinWei, route, address, deadlineTimestamp],
                );

            } else if (bestRoute.type === 'v3' && bestRoute.tickSpacing) {
                // V3 swap
                swapCall = encodeContractCall(
                    CL_CONTRACTS.SwapRouter as Address,
                    SWAP_ROUTER_ABI,
                    'exactInputSingle',
                    [{
                        tokenIn: actualTokenIn.address as Address,
                        tokenOut: actualTokenOut.address as Address,
                        tickSpacing: bestRoute.tickSpacing,
                        recipient: address,
                        deadline: deadlineTimestamp,
                        amountIn: amountInWei,
                        amountOutMinimum: amountOutMinWei,
                        sqrtPriceLimitX96: BigInt(0),
                    }],
                    tokenIn?.isNative ? amountInWei : undefined,
                );
            } else {
                // Multi-hop or unsupported - fall back to sequential
                setAutoSwapAfterApproval(true);
                const hash = await writeContractAsync({
                    address: actualTokenIn.address as Address,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [routerToApprove as Address, amountInWei],
                });
                setPendingApprovalHash(hash);
                return;
            }

            // Approve + swap (EIP-5792 batch or sequential fallback)
            const approveCall = encodeApproveCall(
                actualTokenIn.address as Address,
                routerToApprove as Address,
                amountInWei
            );

            const hash = await batchOrSequential([approveCall, swapCall]);
            setTxHash(hash || null);
            setAmountIn('');
            setAmountOut('');
            setBestRoute(null);
            setIsApproving(false);
            setRouteLocked(false);
            success('Swap successful!');

        } catch (err) {
            console.error('Approve/swap error:', err);
            const errorMsg = getSwapErrorMessage(err);
            setError(errorMsg);
            setIsApproving(false);
            setRouteLocked(false);
            setAutoSwapAfterApproval(false);
        }
    };

    // Handle input typing
    const handleTypeInput = useCallback((value: string) => {
        setIndependentField('INPUT');
        setTypedValue(value);
        setAmountIn(value);
        // Clear output if input is empty, otherwise keep old output (stale) until new quote
        if (!value) setAmountOut('');
    }, []);

    // Handle output typing
    const handleTypeOutput = useCallback((value: string) => {
        setIndependentField('OUTPUT');
        setTypedValue(value);
        setAmountOut(value);
        // Clear input if output is empty
        if (!value) setAmountIn('');
    }, []);

    // ===== V2 Volatile Quote (using wagmi hook) =====
    const v2VolatileRoute: Route[] = actualTokenIn && actualTokenOut ? [{
        from: actualTokenIn.address as Address,
        to: actualTokenOut.address as Address,
        stable: false,
        factory: V2_CONTRACTS.PoolFactory as Address,
    }] : [];

    const { data: v2VolatileQuote } = useReadContract({
        address: V2_CONTRACTS.Router as Address,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: amountIn && actualTokenIn && parseFloat(amountIn) > 0
            ? [parseUnits(amountIn, actualTokenIn.decimals), v2VolatileRoute]
            : undefined,
        query: {
            enabled: !!actualTokenIn && !!actualTokenOut && !!amountIn && parseFloat(amountIn) > 0 && independentField === 'INPUT',
            refetchInterval: false,
            staleTime: 30_000,
        },
    });

    // ===== V2 Stable Quote (using wagmi hook) =====
    const v2StableRoute: Route[] = actualTokenIn && actualTokenOut ? [{
        from: actualTokenIn.address as Address,
        to: actualTokenOut.address as Address,
        stable: true,
        factory: V2_CONTRACTS.PoolFactory as Address,
    }] : [];

    const { data: v2StableQuote } = useReadContract({
        address: V2_CONTRACTS.Router as Address,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: amountIn && actualTokenIn && parseFloat(amountIn) > 0
            ? [parseUnits(amountIn, actualTokenIn.decimals), v2StableRoute]
            : undefined,
        query: {
            enabled: !!actualTokenIn && !!actualTokenOut && !!amountIn && parseFloat(amountIn) > 0 && independentField === 'INPUT',
            refetchInterval: false,
            staleTime: 30_000,
        },
    });

    // Price impact state — computed inside the route-finding effect
    const [spotRate, setSpotRate] = useState<number | null>(null);

    // Calculate price impact from spot rate vs execution rate
    const priceImpact = (() => {
        if (!spotRate || !amountIn || !amountOut || parseFloat(amountIn) <= 0) return null;
        const execRate = parseFloat(amountOut) / parseFloat(amountIn);
        const impact = ((spotRate - execRate) / spotRate) * 100;
        return impact > 0 ? impact : 0;
    })();

    const highPriceImpact = priceImpact !== null && priceImpact > 2;

    // Reset acceptance when amounts/tokens change
    useEffect(() => {
        setPriceImpactAccepted(false);
    }, [amountIn, amountOut, tokenIn, tokenOut]);

    // ===== Find Best Route (V2 + V3) =====
    useEffect(() => {
        const findBestRoute = async () => {
            // Don't update route while user is approving/swapping
            if (routeLocked) return;

            // If EXACT INPUT: Check amountIn
            // If EXACT OUTPUT: Check amountOut
            const hasAmount = independentField === 'INPUT'
                ? (amountIn && parseFloat(amountIn) > 0)
                : (amountOut && parseFloat(amountOut) > 0);

            if (!tokenIn || !tokenOut || !hasAmount || !actualTokenOut) {
                setBestRoute(null);
                if (independentField === 'INPUT') setAmountOut('');
                else setAmountIn('');
                setNoRouteFound(false);
                return;
            }

            setIsQuoting(true);
            setNoRouteFound(false);

            try {
                const routes: BestRoute[] = [];

                // === Check for direct wrap/unwrap (WETH <-> SEI) ===
                // Use address comparison for reliability (isNative may not always be preserved)
                const seiAddress = ETH.address.toLowerCase();
                const wseiAddress = WETH.address.toLowerCase();
                const tokenInAddr = tokenIn.address.toLowerCase();
                const tokenOutAddr = tokenOut.address.toLowerCase();

                const isWrap = tokenInAddr === seiAddress && tokenOutAddr === wseiAddress;
                const isUnwrap = tokenInAddr === wseiAddress && tokenOutAddr === seiAddress;

                if (isWrap || isUnwrap) {
                    // 1:1 rate for wrap/unwrap
                    setBestRoute({
                        type: 'wrap',
                        amountOut: amountIn,
                        feeLabel: isWrap ? 'Wrap' : 'Unwrap',
                        isWrap,
                    });
                    setAmountOut(amountIn);
                    setIsQuoting(false);
                    return;
                }

                if (independentField === 'INPUT') {
                    // === EXACT INPUT: unified V3 route finder (single + split in 2 RPC batches) ===
                    const feeMap: Record<number, string> = { 1: '0.005%', 2: '1%', 3: '0.03%', 4: '0.05%', 5: '0.26%' };
                    const optimal = await findOptimalRoute(tokenIn, tokenOut, amountIn);

                    if (optimal) {
                        if (optimal.winner === 'split' && optimal.bestSplit) {
                            // Split route wins
                            routes.push({
                                type: 'split',
                                amountOut: optimal.bestSplit.totalAmountOut,
                                feeLabel: `Split ${optimal.bestSplit.legs.map(l => `${l.percent}%`).join('/')}`,
                                splitLegs: optimal.bestSplit.legs.map(l => ({
                                    amountIn: l.amountIn,
                                    amountOut: l.amountOut,
                                    percent: l.percent,
                                    routeType: l.route.routeType,
                                    tickSpacing1: l.route.tickSpacing1 || 0,
                                    tickSpacing2: l.route.tickSpacing2,
                                    intermediate: l.route.intermediate,
                                    label: l.route.routeType === 'direct'
                                        ? `${tokenIn.symbol} → ${tokenOut.symbol} ${feeMap[l.route.tickSpacing1 || 0] || ''}`
                                        : `${tokenIn.symbol} → ${l.route.via} → ${tokenOut.symbol}`,
                                })),
                            });
                        } else if (optimal.bestSingle) {
                            // Single route wins
                            const v3Route = optimal.bestSingle;
                            if (v3Route.routeType === 'direct') {
                                routes.push({
                                    type: 'v3',
                                    amountOut: v3Route.amountOut,
                                    tickSpacing: v3Route.tickSpacing1,
                                    feeLabel: `V3 ${feeMap[v3Route.tickSpacing1 || 10] || ''}`,
                                });
                            } else if (v3Route.routeType === 'multi-hop' && v3Route.intermediate) {
                                routes.push({
                                    type: 'multi-hop',
                                    amountOut: v3Route.amountOut,
                                    feeLabel: v3Route.via ? `via ${v3Route.via}` : 'Multi-hop',
                                    via: v3Route.via,
                                    intermediate: v3Route.intermediate,
                                    tickSpacing1: v3Route.tickSpacing1,
                                    tickSpacing2: v3Route.tickSpacing2,
                                });
                            }
                        }
                    }

                    // === V2 Volatile Quote (instant - already fetched by wagmi hook) ===
                    if (v2VolatileQuote && Array.isArray(v2VolatileQuote) && v2VolatileQuote.length > 1) {
                        const outAmount = formatUnits(v2VolatileQuote[v2VolatileQuote.length - 1] as bigint, actualTokenOut.decimals);
                        if (parseFloat(outAmount) > 0) {
                            routes.push({
                                type: 'v2',
                                amountOut: outAmount,
                                stable: false,
                                feeLabel: 'V2 Volatile',
                            });
                        }
                    }

                    // === V2 Stable Quote (instant - already fetched by wagmi hook) ===
                    if (v2StableQuote && Array.isArray(v2StableQuote) && v2StableQuote.length > 1) {
                        const outAmount = formatUnits(v2StableQuote[v2StableQuote.length - 1] as bigint, actualTokenOut.decimals);
                        if (parseFloat(outAmount) > 0) {
                            routes.push({
                                type: 'v2',
                                amountOut: outAmount,
                                stable: true,
                                feeLabel: 'V2 Stable',
                            });
                        }
                    }
                } else {
                    // === EXACT OUTPUT logic (new) ===

                    // 1. V3 Exact Output
                    const v3Quote = await getQuoteExactOutputV3(tokenIn, tokenOut, amountOut);
                    if (v3Quote && v3Quote.poolExists && v3Quote.amountIn) {
                        const feeMap: Record<number, string> = { 1: '0.005%', 2: '1%', 3: '0.03%', 4: '0.05%', 5: '0.26%' };
                        routes.push({
                            type: 'v3',
                            amountOut: amountOut, // Targeted output
                            amountInComputed: v3Quote.amountIn,
                            tickSpacing: v3Quote.tickSpacing,
                            feeLabel: `V3 ${feeMap[v3Quote.tickSpacing || 10] || ''}`,
                        });
                    }

                    // 2. V2 Exact Output
                    const v2Quote = await getQuoteExactOutput(tokenIn, tokenOut, amountOut, false); // Volatile
                    if (v2Quote) {
                        routes.push({
                            type: 'v2',
                            amountOut: amountOut,
                            amountInComputed: v2Quote.amountIn,
                            stable: false,
                            feeLabel: 'V2 Volatile',
                        });
                    }

                    const v2StableQuoteRes = await getQuoteExactOutput(tokenIn, tokenOut, amountOut, true); // Stable
                    if (v2StableQuoteRes) {
                        routes.push({
                            type: 'v2',
                            amountOut: amountOut,
                            amountInComputed: v2StableQuoteRes.amountIn,
                            stable: true,
                            feeLabel: 'V2 Stable',
                        });
                    }
                }

                // Check WowMax + KyberSwap aggregators in parallel alongside local routes
                if (independentField === 'INPUT' && tokenIn && tokenOut && actualTokenIn && actualTokenOut) {
                    // WowMax takes human-readable amount, KyberSwap takes wei
                    const amountInWeiStr = parseUnits(amountIn, actualTokenIn.decimals).toString();
                    // Proxy always wraps native ETH → WETH before calling router,
                    // so KyberSwap must receive WETH (not native ETH)
                    const kyberTokenIn = actualTokenIn.address;
                    const kyberTokenOut = actualTokenOut.address;
                    const [wmQuote, kyberQuote] = await Promise.allSettled([
                        getWowMaxQuote(actualTokenIn.address, actualTokenOut.address, amountIn),
                        getKyberQuote(kyberTokenIn, kyberTokenOut, amountInWeiStr),
                    ]);

                    if (wmQuote.status === 'fulfilled' && wmQuote.value && parseFloat(wmQuote.value.amountOut) > 0) {
                        const outDecimals = wmQuote.value.to?.decimals ?? actualTokenOut.decimals;
                        routes.push({
                            type: 'wowmax',
                            amountOut: formatUnits(BigInt(wmQuote.value.amountOut), outDecimals),
                            feeLabel: 'Aggregated',
                        });
                    }

                    if (kyberQuote.status === 'fulfilled' && kyberQuote.value && parseFloat(kyberQuote.value.amountOut) > 0) {
                        routes.push({
                            type: 'kyberswap',
                            amountOut: formatUnits(BigInt(kyberQuote.value.amountOut), actualTokenOut.decimals),
                            feeLabel: 'Aggregated',
                            kyberRouteSummary: kyberQuote.value.routeSummary,
                        });
                    }
                }

                // Find best route
                if (routes.length > 0) {
                    if (independentField === 'INPUT') {
                        const best = routes.reduce((a, b) =>
                            parseFloat(a.amountOut) > parseFloat(b.amountOut) ? a : b
                        );
                        setBestRoute(best);
                        setAmountOut(best.amountOut);
                    } else {
                        // For exact output, best is LOWEST input
                        const best = routes.reduce((a, b) =>
                            parseFloat(a.amountInComputed || '999999999') < parseFloat(b.amountInComputed || '999999999') ? a : b
                        );
                        setBestRoute(best);
                        setAmountIn(best.amountInComputed || '');
                    }

                    // Fetch spot rate (tiny amount, 1 batch RPC, no split overhead)
                    try {
                        const spot = await getSpotRate(tokenIn, tokenOut);
                        setSpotRate(spot);
                    } catch {
                        setSpotRate(null);
                    }
                } else {
                    setBestRoute(null);
                    if (independentField === 'INPUT') setAmountOut('');
                    else setAmountIn('');
                    setNoRouteFound(true);
                }
            } catch (err) {
                console.error('Quote error:', err);
                setBestRoute(null);
                setNoRouteFound(true);
            }

            setIsQuoting(false);
        };

        const debounce = setTimeout(findBestRoute, DEBOUNCE_MS.QUOTE);
        return () => clearTimeout(debounce);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenIn, tokenOut, amountIn, amountOut, actualTokenOut, routeLocked, independentField, quoteRefreshTick]);

    // Auto-refresh quote every 30 seconds (not on every RPC data change)
    useEffect(() => {
        if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) return;
        const interval = setInterval(() => setQuoteRefreshTick(t => t + 1), 30_000);
        return () => clearInterval(interval);
    }, [tokenIn, tokenOut, amountIn]);

    // Handle slippage change with validation
    const handleSlippageChange = useCallback((value: number) => {
        if (value < SLIPPAGE.MIN) {
            setSlippageError(`Slippage must be at least ${SLIPPAGE.MIN}%`);
            return;
        }
        if (value > SLIPPAGE.MAX) {
            setSlippageError(`Slippage cannot exceed ${SLIPPAGE.MAX}%`);
            return;
        }
        setSlippageError(null);
        setSlippage(value);
    }, []);

    // Swap tokens
    const handleSwapTokens = useCallback(() => {
        if (tokenOut) handleSetTokenIn(tokenOut);
        if (tokenIn) handleSetTokenOut(tokenIn);
        if (independentField === 'INPUT') {
            setAmountIn(amountOut);
            setAmountOut(amountIn);
            // After swap, we keep INPUT as independent? 
            // Usually we switch tokens and keep amounts.
            // If I swap, I now pay the old output token.
            // So `amountOut` becomes `amountIn`.
        } else {
            setAmountIn(amountOut);
            setAmountOut(amountIn);
            setIndependentField('INPUT'); // Reset to input mode for simplicity logic? Or keep OUTPUT?
            // Usually keeping amounts implies mode switch.
        }
        setBestRoute(null);
    }, [tokenIn, tokenOut, amountIn, amountOut, independentField]);

    // Calculate min amount out with slippage
    const amountOutMin = amountOut
        ? (parseFloat(amountOut) * (1 - slippage / 100)).toFixed(6)
        : '0';

    // Check if swap is valid
    const canSwap = isConnected &&
        tokenIn &&
        tokenOut &&
        amountIn &&
        parseFloat(amountIn) > 0 &&
        bestRoute &&
        parseFloat(bestRoute.amountOut) > 0 &&
        // For exact output, check amountInComputed
        (independentField === 'INPUT' ? true : (bestRoute.amountInComputed && parseFloat(bestRoute.amountInComputed) > 0)) &&
        // Require acceptance for high price impact
        (!highPriceImpact || priceImpactAccepted);

    // Calculate rate — use USDC spot rate (market price) when available, fallback to exec rate
    const rate = spotRate
        ? spotRate.toString()
        : (amountIn && amountOut && parseFloat(amountIn) > 0
            ? (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)
            : null);

    const handleSwap = async () => {
        if (!tokenIn || !tokenOut || !bestRoute) return;
        // For wrap/unwrap, we don't need the full canSwap check
        if (bestRoute.type !== 'wrap' && !canSwap) return;

        setRouteLocked(true); // Lock route during swap

        let result;

        // Handle wrap/unwrap directly
        if (bestRoute.type === 'wrap') {
            try {
                const amountWei = parseUnits(amountIn, 18);
                let hash: `0x${string}`;

                if (bestRoute.isWrap) {
                    // Wrap: SEI -> WETH (deposit)
                    hash = await writeContractAsync({
                        address: WETH.address as Address,
                        abi: WETH_ABI,
                        functionName: 'deposit',
                        args: [],
                        value: amountWei,
                    });
                } else {
                    // Unwrap: WETH -> SEI (withdraw)
                    hash = await writeContractAsync({
                        address: WETH.address as Address,
                        abi: WETH_ABI,
                        functionName: 'withdraw',
                        args: [amountWei],
                    });
                }
                result = { hash };
            } catch (err: unknown) {
                console.error('Wrap/unwrap error:', err);
                const errorMsg = getSwapErrorMessage(err);
                setError(errorMsg);
                result = null;
            }
        } else if (bestRoute.type === 'v2') {
            result = await executeSwap(
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMin,
                bestRoute.stable || false,
                deadline,
                independentField === 'OUTPUT' ? 'exactOut' : 'exactIn'
            );
        } else if (bestRoute.type === 'v3') {
            if (!bestRoute.tickSpacing) return;
            result = await executeSwapV3(
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMin,
                bestRoute.tickSpacing,
                slippage
            );
        } else if (bestRoute.type === 'multi-hop') {
            // Multi-hop route - execute via intermediate token
            if (!bestRoute.intermediate) {
                console.error('Multi-hop route missing intermediate token');
                return;
            }
            result = await executeMultiHopSwapV3(
                tokenIn,
                bestRoute.intermediate,
                tokenOut,
                amountIn,
                amountOutMin,
                bestRoute.tickSpacing1,
                bestRoute.tickSpacing2,
                slippage
            );
        } else if (bestRoute.type === 'split' && bestRoute.splitLegs) {
            // Split route - execute multiple legs via multicall
            const legs = bestRoute.splitLegs.map(leg => {
                const legOutMin = (parseFloat(leg.amountOut) * (1 - slippage / 100)).toFixed(6);
                return {
                    amountIn: leg.amountIn,
                    amountOutMin: legOutMin,
                    routeType: leg.routeType,
                    tickSpacing1: leg.tickSpacing1,
                    tickSpacing2: leg.tickSpacing2,
                    intermediate: leg.intermediate,
                };
            });
            result = await executeSplitSwapV3(tokenIn, tokenOut, legs, slippage);
        } else if (bestRoute.type === 'wowmax') {
            // WowMax aggregator route — routed through WindSwap Aggregator Proxy (1% fee)
            setIsSwappingWowmax(true);
            try {
                if (!actualTokenIn || !actualTokenOut || !address) { setIsSwappingWowmax(false); return; }
                const proxyAddress = V2_CONTRACTS.AggregatorProxy as Address;

                // Get swap calldata from WowMax (targeting the proxy as recipient)
                // Use higher slippage for aggregator route (user slippage + 1% fee buffer)
                // WowMax API expects plain percentage (e.g. 20 = 20%), multiplies by 100 internally.
                // Contract max is 2000 (= 20%). We pass max to let WowMax be lenient —
                // our proxy's own minAmountOut check still enforces the user's actual slippage.
                const wmSlippage = 20; // always max, proxy guards the real limit
                const swapData = await getWowMaxSwapData(
                    actualTokenIn.address,
                    actualTokenOut.address,
                    amountIn,
                    wmSlippage,
                    proxyAddress, // proxy receives tokens, deducts fee, forwards to user
                );
                if (!swapData || !swapData.data) {
                    setError('Failed to get swap data from WowMax');
                    setRouteLocked(false);
                    setIsSwappingWowmax(false);
                    return;
                }

                const isNativeIn = tokenIn.isNative;
                const tokenInAddr = isNativeIn ? '0x0000000000000000000000000000000000000000' as Address : actualTokenIn.address as Address;
                const tokenOutAddr = tokenOut?.isNative ? '0x0000000000000000000000000000000000000000' as Address : actualTokenOut.address as Address;

                // Approve proxy to pull input tokens (ERC20 only, skip if already sufficient)
                if (!isNativeIn && (allowanceProxy === undefined || (allowanceProxy as bigint) < amountInWei)) {
                    await writeContractAsync({
                        address: actualTokenIn.address as Address,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [proxyAddress, amountInWei],
                    });
                    refetchAllowanceProxy();
                }

                // minAmountOut: amountOut[0] is already in wei — use BigInt to avoid double-scaling
                const expectedOutWei = BigInt(swapData.amountOut[0] ?? '0');
                const slippageBps = BigInt(Math.floor(Math.max(slippage, 5) * 100)); // e.g. 5% → 500
                const minOut = expectedOutWei * (10000n - slippageBps - 100n) / 10000n; // subtract slippage + 1% fee

                // Call proxy.swap() — it routes through WowMax, deducts 1% fee, sends rest to user
                const hash = await writeContractAsync({
                    address: proxyAddress,
                    abi: AGGREGATOR_PROXY_ABI,
                    functionName: 'swap',
                    args: [
                        tokenInAddr,
                        tokenOutAddr,
                        amountInWei,
                        minOut,
                        swapData.contract as Address,
                        swapData.data as `0x${string}`,
                    ],
                    value: isNativeIn ? amountInWei : BigInt(0),
                });
                result = { hash };
            } catch (err: unknown) {
                console.error('WowMax swap error:', err);
                if (!isUserRejection(err)) {
                    const errorMsg = getSwapErrorMessage(err);
                    setError(errorMsg);
                }
                result = null;
            } finally {
                setIsSwappingWowmax(false);
            }
        } else if (bestRoute.type === 'kyberswap') {
            setIsSwappingWowmax(true);
            try {
                if (!actualTokenIn || !actualTokenOut || !address || !bestRoute.kyberRouteSummary) { setIsSwappingWowmax(false); return; }
                const proxyAddress = V2_CONTRACTS.AggregatorProxy as Address;
                const isNativeIn = tokenIn.isNative;
                const tokenInAddr = isNativeIn ? '0x0000000000000000000000000000000000000000' as Address : actualTokenIn.address as Address;
                const tokenOutAddr = tokenOut?.isNative ? '0x0000000000000000000000000000000000000000' as Address : actualTokenOut.address as Address;

                // KyberSwap slippage in bps (50 = 0.5%)
                const kyberSlippage = Math.floor(Math.max(slippage, 0.5) * 100);

                // Build swap data with proxy as recipient so it can deduct fee
                const swapData = await getKyberSwapData(
                    bestRoute.kyberRouteSummary,
                    proxyAddress, // sender = proxy (proxy holds tokens during swap)
                    proxyAddress, // recipient = proxy (proxy receives output, then forwards minus fee)
                    kyberSlippage,
                );
                if (!swapData || !swapData.data) {
                    setError('Failed to get swap data from KyberSwap');
                    setRouteLocked(false);
                    setIsSwappingWowmax(false);
                    return;
                }

                // Approve proxy for ERC20 input
                if (!isNativeIn && (allowanceProxy === undefined || (allowanceProxy as bigint) < amountInWei)) {
                    await writeContractAsync({
                        address: actualTokenIn.address as Address,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [proxyAddress, amountInWei],
                    });
                    refetchAllowanceProxy();
                }

                const expectedOutWei = BigInt(swapData.amountOut ?? '0');
                const slippageBps = BigInt(Math.floor(Math.max(slippage, 5) * 100));
                const minOut = expectedOutWei * (10000n - slippageBps - 100n) / 10000n;

                const hash = await writeContractAsync({
                    address: proxyAddress,
                    abi: AGGREGATOR_PROXY_ABI,
                    functionName: 'swap',
                    args: [
                        tokenInAddr,
                        tokenOutAddr,
                        amountInWei,
                        minOut,
                        swapData.routerAddress as Address,
                        swapData.data as `0x${string}`,
                    ],
                    value: isNativeIn ? amountInWei : BigInt(0),
                });
                result = { hash };
            } catch (err: unknown) {
                console.error('KyberSwap swap error:', err);
                if (!isUserRejection(err)) setError(getSwapErrorMessage(err));
                result = null;
            } finally {
                setIsSwappingWowmax(false);
            }
        }

        if (result) {
            setTxHash(result.hash);
            setAmountIn('');
            setAmountOut('');
            setBestRoute(null);
            success('Swap successful!');
        } else {
            haptic('error');
            if (!isUserRejection(error)) {
                const errorMsg = getSwapErrorMessage(error);
                setError(errorMsg);
                showError(errorMsg);
            }
        }
        setRouteLocked(false); // Unlock after swap completes or fails
    };

    // Auto-trigger swap when swapTrigger increments (after approval)
    useEffect(() => {
        if (swapTrigger > 0) {
            handleSwap();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [swapTrigger]);

    return (
        <div className="swap-card max-w-md mx-auto">
            {/* Header - Compact */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-bold">Swap</h2>
                <div className="flex items-center gap-1">
                    {bestRoute && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${bestRoute.type === 'v3' || bestRoute.type === 'multi-hop'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-primary/20 text-primary'
                            }`}>
                            {bestRoute.feeLabel}
                        </span>
                    )}
                    {noRouteFound && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400">No Route</span>
                    )}
                    {isQuoting && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-gray-400">...</span>
                    )}
                    <SwapSettings
                        slippage={slippage}
                        deadline={deadline}
                        onSlippageChange={handleSlippageChange}
                        onDeadlineChange={setDeadline}
                    />
                </div>
            </div>

            {/* Error Display - Compact */}
            {(error || hookError) && (
                <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    {error || hookError}
                </div>
            )}

            {/* Success Display */}
            {txHash && (
                <div className="mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                    Success! <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">View →</a>
                </div>
            )}

            {/* Token In */}
            <TokenInput
                label="You pay"
                token={tokenIn}
                amount={amountIn}
                balance={formattedBalanceIn}
                rawBalance={rawBalanceIn}
                onAmountChange={handleTypeInput}
                onTokenSelect={handleSetTokenIn}
                showMaxButton
            />

            {/* Swap Direction Button */}
            <div className="relative h-0 flex items-center justify-center z-10">
                <motion.button
                    onClick={handleSwapTokens}
                    className="swap-arrow-btn"
                    aria-label="Swap tokens direction"
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
                balance={formattedBalanceOut}
                onAmountChange={handleTypeOutput}
                onTokenSelect={handleSetTokenOut}
            />

            {/* Rate Info - Compact */}
            {rate && tokenIn && tokenOut && (
                <div className="mt-3 p-2 rounded-lg bg-white/5 text-xs space-y-1">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Rate</span>
                        <span>1 {tokenIn.symbol} = {parseFloat(rate) < 0.0001 ? parseFloat(rate).toExponential(2) : parseFloat(rate).toFixed(4)} {tokenOut.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Min. received</span>
                        <span>{parseFloat(amountOutMin).toFixed(4)} {tokenOut.symbol}</span>
                    </div>
                    {priceImpact !== null && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">Price Impact</span>
                            <span className={priceImpact > 5 ? 'text-red-500 font-bold' : priceImpact > 2 ? 'text-orange-400 font-semibold' : 'text-green-400'}>
                                {priceImpact < 0.01 ? '<0.01' : priceImpact.toFixed(2)}%
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-gray-400">Slippage</span>
                        <span>{slippage}%</span>
                    </div>
                    {bestRoute && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">Route</span>
                            <span className="text-right">
                                {bestRoute.type === 'split' && bestRoute.splitLegs ? (
                                    <span className="flex flex-col items-end gap-0.5">
                                        {bestRoute.splitLegs.map((leg, i) => (
                                            <span key={i} className="text-[10px]">
                                                {leg.percent}% {leg.label}
                                            </span>
                                        ))}
                                    </span>
                                ) : bestRoute.type === 'multi-hop' && bestRoute.via ? (
                                    `${tokenIn.symbol} → ${bestRoute.via} → ${tokenOut.symbol}`
                                ) : bestRoute.type === 'wrap' ? (
                                    bestRoute.isWrap ? 'Wrap' : 'Unwrap'
                                ) : (
                                    `${tokenIn.symbol} → ${tokenOut.symbol}`
                                )}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* High Price Impact Warning */}
            {highPriceImpact && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/40">
                    <p className="text-red-400 text-xs font-semibold mb-2">
                        Price impact is {priceImpact!.toFixed(2)}% — you may lose a significant portion of your funds due to low liquidity.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={priceImpactAccepted}
                            onChange={(e) => setPriceImpactAccepted(e.target.checked)}
                            className="mt-0.5 accent-red-500"
                        />
                        <span className="text-xs text-red-300">
                            I understand that this swap has high price impact and I may receive significantly fewer tokens than expected. I accept the risk of potential loss.
                        </span>
                    </label>
                </div>
            )}

            {/* Approve/Swap Button */}
            {needsApproval && canSwap ? (
                <button
                    onClick={() => { haptic('medium'); handleApproveAndSwap(); }}
                    disabled={isApproving || isLoading}
                    className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
                    aria-label="Approve and swap"
                >
                    {isApproving ? 'Approving...' : isLoading ? 'Swapping...' : `Approve & Swap`}
                </button>
            ) : (
                <button
                    onClick={() => { haptic('medium'); handleSwap(); }}
                    disabled={!canSwap || isLoading}
                    className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
                    aria-label="Execute swap"
                >
                    {isSwappingWowmax
                        ? 'Swapping...'
                        : isLoading
                        ? 'Swapping...'
                        : !isConnected
                            ? 'Connect Wallet'
                            : noRouteFound
                                ? 'No Route Found'
                                : !amountIn
                                    ? 'Enter Amount'
                                    : highPriceImpact && !priceImpactAccepted
                                        ? 'Accept Price Impact to Swap'
                                        : highPriceImpact
                                            ? 'Swap Anyway'
                                            : 'Swap'}
                </button>
            )}

            {/* Slippage Error */}
            {slippageError && (
                <div className="mt-2 text-center text-xs text-red-400">
                    {slippageError}
                </div>
            )}

            <div className="mt-3 text-center text-[10px] text-gray-500">
                Auto-routes via V2 + V3 pools
            </div>
        </div>
    );
}
