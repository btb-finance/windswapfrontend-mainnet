'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { useBatchTransactions } from '@/hooks/useBatchTransactions';
import { formatUnits, parseUnits, Address } from 'viem';
import { Token, DEFAULT_TOKEN_LIST, ETH, WETH, USDC } from '@/config/tokens';
import { CL_CONTRACTS } from '@/config/contracts';
import { TokenSelector } from '@/components/common/TokenSelector';
import { useLiquidity } from '@/hooks/useLiquidity';
import { useTokenBalance, useTokenAllowance, truncateToDecimals, bigIntPercentage } from '@/hooks/useToken';
import { NFT_POSITION_MANAGER_ABI, ERC20_ABI } from '@/config/abis';
import { getRpcForPoolData, getRpcForUserData } from '@/utils/rpc';
import { usePoolData } from '@/providers/PoolDataProvider';
import { calculatePoolAPR, formatAPR } from '@/utils/aprCalculator';
import { GAUGE_LIST } from '@/config/gauges';
import { isStablecoinPair, tickToStablecoinPrice } from '@/config/stablecoinTicks';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/hooks/useHaptic';
import {
    calculateOptimalAmounts,
    getRequiredTokens,
    priceToTick,
    tickToPrice,
    MAX_TICK,
    MIN_TICK
} from '@/utils/liquidityMath';
import { useTickLensData } from '@/hooks/useTickLensData';
import { getDeadline } from '@/utils/format';
import { extractErrorMessage } from '@/utils/errors';
import { LiquidityDepthChart } from '@/components/pools/LiquidityDepthChart';

// Smart price formatter for displaying very small or large prices
function formatSmartPrice(price: number): string {
    if (price === 0) return '0';

    const absPrice = Math.abs(price);

    // For very small numbers (< 0.0001), use significant digits
    if (absPrice < 0.0001) {
        // Find first non-zero digit and show 4 significant digits
        return price.toPrecision(4);
    }

    // For small numbers (< 1), show up to 8 decimals
    if (absPrice < 1) {
        return price.toFixed(8).replace(/\.?0+$/, '');
    }

    // For normal numbers (1-10000), show up to 8 decimals to preserve exact tick boundaries
    if (absPrice < 10000) {
        return price.toFixed(8).replace(/\.?0+$/, '');
    }

    // For large numbers, use 6 decimals to prevent tick precision loss
    return price.toLocaleString('en-US', { maximumFractionDigits: 6 }).replace(/,/g, '');
}

type PoolType = 'v2' | 'cl';
type TxStep = 'idle' | 'approving0' | 'approving1' | 'minting' | 'approving_nft' | 'staking' | 'done' | 'error';

interface PoolConfig {
    token0?: Token;
    token1?: Token;
    poolType: PoolType;
    tickSpacing?: number;
    stable?: boolean;
}

interface AddLiquidityModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPool?: PoolConfig;
}

// Mobile-optimized styles
const mobileStyles = {
    overlay: "fixed inset-0 z-50 flex items-end sm:items-center justify-center",
    modal: "relative z-10 w-full sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] overflow-hidden bg-[#0d0d14] sm:rounded-2xl rounded-t-3xl border border-white/10 shadow-2xl flex flex-col",
    header: "sticky top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-white/10 bg-[#0d0d14]/95 backdrop-blur-sm",
    scrollArea: "flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 space-y-5",
    footer: "sticky bottom-0 z-20 px-4 py-4 sm:px-6 sm:py-5 border-t border-white/10 bg-[#0d0d14]/95 backdrop-blur-sm",
};

export function AddLiquidityModal({ isOpen, onClose, initialPool }: AddLiquidityModalProps) {
    const { isConnected, address } = useAccount();
    const [poolType, setPoolType] = useState<PoolType>(initialPool?.poolType || 'v2');

    // Token state
    const [tokenA, setTokenA] = useState<Token | undefined>(initialPool?.token0 || ETH);
    const [tokenB, setTokenB] = useState<Token | undefined>(initialPool?.token1 || USDC);
    const [amountA, setAmountA] = useState('');
    const [amountB, setAmountB] = useState('');
    const [stable, setStable] = useState(initialPool?.stable || false);
    const [selectorOpen, setSelectorOpen] = useState<'A' | 'B' | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    // CL specific state
    const [tickSpacing, setTickSpacing] = useState(initialPool?.tickSpacing || 2);
    const [priceLower, setPriceLower] = useState('');
    const [priceUpper, setPriceUpper] = useState('');
    const [clPoolPrice, setClPoolPrice] = useState<number | null>(null);
    const [clPoolAddress, setClPoolAddress] = useState<string | null>(null);
    const [initialPrice, setInitialPrice] = useState('');

    // Transaction state
    const [txProgress, setTxProgress] = useState<TxStep>('idle');
    const [txError, setTxError] = useState<string | null>(null);

    // Auto-stake state
    const [autoStake, setAutoStake] = useState(true); // Default to enabled

    // Hooks
    const { addLiquidity, isLoading, error } = useLiquidity();
    const { raw: rawBalanceA, rawBigInt: rawBigIntA, formatted: balanceA } = useTokenBalance(tokenA);
    const { raw: rawBalanceB, rawBigInt: rawBigIntB, formatted: balanceB } = useTokenBalance(tokenB);
    const { writeContractAsync } = useWriteContract();
    const { batchOrSequential, encodeContractCall, buildApproveCallIfNeeded } = useBatchTransactions();
    const { poolRewards, windPrice, seiPrice, allPools } = usePoolData();
    const toast = useToast();

    // Find gauge for current pool configuration
    const getPoolGauge = useCallback(() => {
        if (!tokenA || !tokenB || poolType !== 'cl') return null;

        const actualTokenA = tokenA.isNative ? WETH : tokenA;
        const actualTokenB = tokenB.isNative ? WETH : tokenB;

        // Find matching gauge by tokens and tick spacing
        const gauge = GAUGE_LIST.find(g => {
            if (g.type !== 'CL' || !g.gauge || g.tickSpacing !== tickSpacing) return false;
            const matchesAB = g.token0.toLowerCase() === actualTokenA.address.toLowerCase() &&
                g.token1.toLowerCase() === actualTokenB.address.toLowerCase();
            const matchesBA = g.token0.toLowerCase() === actualTokenB.address.toLowerCase() &&
                g.token1.toLowerCase() === actualTokenA.address.toLowerCase();
            return matchesAB || matchesBA;
        });

        return gauge?.gauge || null;
    }, [tokenA, tokenB, poolType, tickSpacing]);

    const gaugeAddress = getPoolGauge();
    const hasGauge = !!gaugeAddress;


    // Initialize from pool config when modal opens
    useEffect(() => {
        if (isOpen && initialPool) {
            if (initialPool.token0) setTokenA(initialPool.token0);
            if (initialPool.token1) setTokenB(initialPool.token1);
            setPoolType(initialPool.poolType);
            if (initialPool.tickSpacing) setTickSpacing(initialPool.tickSpacing);
            if (initialPool.stable !== undefined) setStable(initialPool.stable);
        }
    }, [isOpen, initialPool]);

    // Auto-detect stablecoin pairs and set appropriate tick spacing
    useEffect(() => {
        if (!isOpen || !tokenA || !tokenB || poolType !== 'cl') return;
        // If it's a pre-configured pool with tickSpacing already set, don't override
        if (initialPool?.tickSpacing) return;

        // List of stablecoin symbols
        const STABLES = ['USDC', 'USDT', 'USDC.n', 'DAI', 'FRAX', 'LUSD', 'BUSD'];
        const isAStable = STABLES.includes(tokenA.symbol.toUpperCase());
        const isBStable = STABLES.includes(tokenB.symbol.toUpperCase());

        // If both are stablecoins, use 0.005% (tick spacing 1)
        if (isAStable && isBStable) {
            setTickSpacing(1);
        } else {
            // Otherwise default to 0.03% (tick spacing 3)
            setTickSpacing(3);
        }
    }, [isOpen, tokenA, tokenB, poolType, initialPool]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setAmountA('');
            setAmountB('');
            setPriceLower('');
            setPriceUpper('');
            setInitialPrice('');
            setTxProgress('idle');
            setTxError(null);
            setTxHash(null);
        }
    }, [isOpen]);

    // Fetch CL pool price when tokens or tickSpacing change
    useEffect(() => {
        const fetchPoolPrice = async () => {
            if (!tokenA || !tokenB || poolType !== 'cl') {
                setClPoolPrice(null);
                setClPoolAddress(null);
                return;
            }

            const actualTokenA = tokenA.isNative ? WETH : tokenA;
            const actualTokenB = tokenB.isNative ? WETH : tokenB;

            const [token0, token1] = actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase()
                ? [actualTokenA, actualTokenB]
                : [actualTokenB, actualTokenA];

            try {
                // Step 1: Get pool address first (needed for slot0 call)
                const getPoolSelector = '28af8d0b';
                const token0Padded = token0.address.slice(2).toLowerCase().padStart(64, '0');
                const token1Padded = token1.address.slice(2).toLowerCase().padStart(64, '0');
                const tickHex = tickSpacing.toString(16).padStart(64, '0');
                const getPoolData = `0x${getPoolSelector}${token0Padded}${token1Padded}${tickHex}`;

                const poolResponse = await fetch(getRpcForPoolData(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [{ to: CL_CONTRACTS.CLFactory, data: getPoolData }, 'latest'],
                        id: 1,
                    }),
                });

                const poolResult = await poolResponse.json();
                if (!poolResult.result || poolResult.result === '0x' + '0'.repeat(64)) {
                    setClPoolPrice(null);
                    setClPoolAddress(null);
                    return;
                }

                const pool = '0x' + poolResult.result.slice(-40);
                setClPoolAddress(pool);

                // Step 2: Fetch slot0 for price
                const slot0Selector = '3850c7bd';
                const slot0Response = await fetch(getRpcForPoolData(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [{ to: pool, data: `0x${slot0Selector}` }, 'latest'],
                        id: 2,
                    }),
                });

                const slot0Result = await slot0Response.json();
                if (!slot0Result.result || slot0Result.result === '0x') {
                    setClPoolPrice(null);
                    return;
                }

                // Prefer tick-based price conversion to avoid precision issues from sqrtPriceX96 squaring.
                // slot0 is ABI-encoded: each return value takes 32 bytes (64 hex chars)
                // sqrtPriceX96 (chars 2-65), tick (chars 66-129), ...
                // tick is int24, so we need the last 6 hex chars of the 32-byte word
                const slot0TickHex = slot0Result.result.slice(124, 130);
                let tick = parseInt(slot0TickHex, 16);
                if (tick >= 0x800000) tick -= 0x1000000; // sign extend int24

                const isToken0Base = actualTokenA.address.toLowerCase() === token0.address.toLowerCase();
                const price = tickToPrice(tick, token0.decimals, token1.decimals, isToken0Base);

                setClPoolPrice(price);

                // Auto-set default range when pool price loads
                if (!priceLower && !priceUpper) {
                    // Check if this is a stablecoin or pegged asset pair (1:1 pairs)
                    const isStablePair = isStablecoinPair(
                        actualTokenA.symbol || actualTokenA.address,
                        actualTokenB.symbol || actualTokenB.address
                    );

                    if (isStablePair) {
                        // For stablecoin/pegged pairs, always center around 1.0 (they should trade 1:1)
                        // Use tight ±0.5% range centered on 1.0
                        setPriceLower('0.995');
                        setPriceUpper('1.005');
                    } else {
                        // Standard ±10% range for other pairs
                        setPriceLower((price * 0.9).toFixed(6));
                        setPriceUpper((price * 1.1).toFixed(6));
                    }
                }
            } catch (err) {
                console.error('Error fetching CL pool price:', err);
                setClPoolPrice(null);
                setClPoolAddress(null);
            }
        };

        fetchPoolPrice();
    }, [tokenA, tokenB, tickSpacing, poolType]);

    // Determine if range is one-sided based on current price
    const currentPrice = clPoolPrice ?? (initialPrice ? parseFloat(initialPrice) : null);
    const pLower = priceLower ? parseFloat(priceLower) : 0;
    const pUpper = priceUpper ? parseFloat(priceUpper) : Infinity;

    // For single-sided LP, determine which side
    const isRangeAboveCurrent = currentPrice !== null && pLower > 0 && currentPrice <= pLower;
    const isRangeBelowCurrent = currentPrice !== null && pUpper > 0 && pUpper !== Infinity && currentPrice >= pUpper;
    const isSingleSided = isRangeAboveCurrent || isRangeBelowCurrent;

    // Determine which token is token0 and token1 (for correct single-sided logic)
    const actualTokenA = tokenA?.isNative ? WETH : tokenA;
    const actualTokenB = tokenB?.isNative ? WETH : tokenB;
    const isAToken0 = actualTokenA && actualTokenB ?
        actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase() : true;

    // CORRECT Uniswap V3 CL Math:
    // When range is ABOVE current (current tick < tickLower): deposit token0 ONLY
    // When range is BELOW current (current tick > tickUpper): deposit token1 ONLY
    // In UI terms:
    // - if A is token0 and range is above: deposit A (token0), B should be 0
    // - if A is token0 and range is below: deposit B (token1), A should be 0
    // - if A is token1 and range is above: deposit B (token0), A should be 0
    // - if A is token1 and range is below: deposit A (token1), B should be 0
    const depositTokenAForOneSided = (isRangeAboveCurrent && isAToken0) || (isRangeBelowCurrent && !isAToken0);
    const depositTokenBForOneSided = (isRangeAboveCurrent && !isAToken0) || (isRangeBelowCurrent && isAToken0);

    // Compute current tick for TickLens
    const currentTickForLens = (() => {
        if (!clPoolPrice || !actualTokenA || !actualTokenB) return null;
        const t0Dec = isAToken0 ? (actualTokenA.decimals) : (actualTokenB.decimals);
        const t1Dec = isAToken0 ? (actualTokenB.decimals) : (actualTokenA.decimals);
        const poolPrice = isAToken0 ? clPoolPrice : 1 / clPoolPrice;
        const adjusted = poolPrice * Math.pow(10, t1Dec - t0Dec);
        return Math.round(Math.log(adjusted) / Math.log(1.0001));
    })();

    const { bars: tickLensBars, loading: tickLensLoading } = useTickLensData(
        clPoolAddress,
        tickSpacing,
        currentTickForLens,
    );

    // Auto-calculate the paired token amount for CL using ON-CHAIN SugarHelper contract.
    // Supports BOTH directions:
    //   - A → B  (normal: user typed amountA, calc amountB)
    //   - B → A  (reverse: user typed amountB with no amountA, calc amountA)
    // This handles the case where the user was in single-sided mode (entered only one
    // token), then adjusted the range so it became two-sided — without a reverse calc
    // the other token would stay at 0 and the tx would fail.
    useEffect(() => {
        if (poolType !== 'cl' || !currentPrice) return;

        const hasAmountA = !!amountA && parseFloat(amountA) > 0;
        const hasAmountB = !!amountB && parseFloat(amountB) > 0;

        // Determine calc direction: prefer A→B; fall back to B→A only when A is empty
        const calcAtoB = hasAmountA;
        const calcBtoA = !hasAmountA && hasAmountB;

        if (!calcAtoB && !calcBtoA) return;

        if (!clPoolAddress || pLower <= 0 || pUpper <= 0 || pLower >= pUpper) {
            // Invalid range or no pool - use simple ratio for default case
            if (pLower <= 0 && pUpper === Infinity && calcAtoB) {
                const amtA = parseFloat(amountA);
                const amtB = amtA * currentPrice;
                setAmountB(amtB.toFixed(6));
            }
            return;
        }

        // Check which tokens are needed for this range (in UI terms)
        const required = getRequiredTokens(currentPrice, pLower, pUpper);

        // Single-sided: only one token needed — clear the unused one and skip calc
        if (isAToken0) {
            if (!required.needsToken0 && !required.needsToken1) return; // degenerate
            if (!required.needsToken0) { setAmountA('0'); return; } // range fully above
            if (!required.needsToken1) { setAmountB('0'); return; } // range fully below
        } else {
            if (!required.needsToken1 && !required.needsToken0) return;
            if (!required.needsToken1) { setAmountA('0'); return; }
            if (!required.needsToken0) { setAmountB('0'); return; }
        }

        // Compute token0/token1 decimals based on pool order (needed for fallbacks too)
        const token0Decimals = isAToken0 ? (actualTokenA?.decimals || 18) : (actualTokenB?.decimals || 18);
        const token1Decimals = isAToken0 ? (actualTokenB?.decimals || 18) : (actualTokenA?.decimals || 18);

        // Call on-chain SugarHelper for accurate calculation.
        // Supports A→B (calcAtoB) and B→A (calcBtoA) directions.
        const calculateOnChain = async () => {
            // Calculate ticks from prices (in pool order)
            const priceToTickLocal = (price: number): number => {
                const poolPrice = isAToken0 ? price : 1 / price;
                const adjustedPrice = poolPrice * Math.pow(10, token1Decimals - token0Decimals);
                const rawTick = Math.log(adjustedPrice) / Math.log(1.0001);
                return Math.round(rawTick / tickSpacing) * tickSpacing;
            };
            let tickLower = priceToTickLocal(pLower);
            let tickUpper = priceToTickLocal(pUpper);
            if (tickLower > tickUpper) [tickLower, tickUpper] = [tickUpper, tickLower];

            const { encodeFunctionData } = await import('viem');
            const { SUGAR_HELPER_ABI } = await import('@/config/abis');

            try {
                if (calcAtoB) {
                    // A → B: estimate token1 from token0 (or token0 from token1 if !isAToken0)
                    const inputDecimals = actualTokenA?.decimals || 18;
                    const inputAmountWei = parseUnits(amountA, inputDecimals);
                    const fnName = isAToken0 ? 'estimateAmount1' : 'estimateAmount0';
                    const calldata = encodeFunctionData({
                        abi: SUGAR_HELPER_ABI,
                        functionName: fnName,
                        args: [inputAmountWei, clPoolAddress as Address, BigInt(0), tickLower, tickUpper],
                    });
                    const res = await fetch(getRpcForPoolData(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: CL_CONTRACTS.SugarHelper, data: calldata }, 'latest'], id: 1 }),
                    });
                    const result = await res.json();
                    if (result.result && result.result !== '0x' && result.result.length > 2) {
                        const outputDecimals = actualTokenB?.decimals || 18;
                        const parsed = parseFloat(formatUnits(BigInt(result.result), outputDecimals));
                        setAmountB(parsed > 0 && isFinite(parsed) ? parsed.toFixed(outputDecimals).replace(/\.?0+$/, '') : '0');
                    } else {
                        // Fallback to frontend calc
                        const position = { currentPrice, priceLower: pLower, priceUpper: pUpper, token0Decimals, token1Decimals, tickSpacing, isToken0Base: isAToken0 };
                        const r = calculateOptimalAmounts(parseFloat(amountA), isAToken0, position);
                        const out = isAToken0 ? r.amount1 : r.amount0;
                        const dec = isAToken0 ? token1Decimals : token0Decimals;
                        setAmountB(out > 0 && isFinite(out) ? out.toFixed(dec).replace(/\.?0+$/, '') : '0');
                    }
                } else {
                    // B → A: estimate token0 from token1 (or token1 from token0 if !isAToken0)
                    const inputDecimals = actualTokenB?.decimals || 18;
                    const inputAmountWei = parseUnits(amountB, inputDecimals);
                    const fnName = isAToken0 ? 'estimateAmount0' : 'estimateAmount1';
                    const calldata = encodeFunctionData({
                        abi: SUGAR_HELPER_ABI,
                        functionName: fnName,
                        args: [inputAmountWei, clPoolAddress as Address, BigInt(0), tickLower, tickUpper],
                    });
                    const res = await fetch(getRpcForPoolData(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: CL_CONTRACTS.SugarHelper, data: calldata }, 'latest'], id: 1 }),
                    });
                    const result = await res.json();
                    if (result.result && result.result !== '0x' && result.result.length > 2) {
                        const outputDecimals = actualTokenA?.decimals || 18;
                        const parsed = parseFloat(formatUnits(BigInt(result.result), outputDecimals));
                        setAmountA(parsed > 0 && isFinite(parsed) ? parsed.toFixed(outputDecimals).replace(/\.?0+$/, '') : '0');
                    } else {
                        // Fallback to frontend calc
                        const position = { currentPrice, priceLower: pLower, priceUpper: pUpper, token0Decimals, token1Decimals, tickSpacing, isToken0Base: isAToken0 };
                        const r = calculateOptimalAmounts(parseFloat(amountB), !isAToken0, position);
                        const out = isAToken0 ? r.amount0 : r.amount1;
                        const dec = isAToken0 ? token0Decimals : token1Decimals;
                        setAmountA(out > 0 && isFinite(out) ? out.toFixed(dec).replace(/\.?0+$/, '') : '0');
                    }
                }
            } catch (error) {
                console.error('Error calling SugarHelper:', error);
                // Fallback to frontend calculation
                if (calcAtoB) {
                    const position = { currentPrice, priceLower: pLower, priceUpper: pUpper, token0Decimals, token1Decimals, tickSpacing, isToken0Base: isAToken0 };
                    const r = calculateOptimalAmounts(parseFloat(amountA), isAToken0, position);
                    const out = isAToken0 ? r.amount1 : r.amount0;
                    const dec = isAToken0 ? token1Decimals : token0Decimals;
                    setAmountB(out > 0 && isFinite(out) ? out.toFixed(dec).replace(/\.?0+$/, '') : '0');
                } else {
                    const position = { currentPrice, priceLower: pLower, priceUpper: pUpper, token0Decimals, token1Decimals, tickSpacing, isToken0Base: isAToken0 };
                    const r = calculateOptimalAmounts(parseFloat(amountB), !isAToken0, position);
                    const out = isAToken0 ? r.amount0 : r.amount1;
                    const dec = isAToken0 ? token0Decimals : token1Decimals;
                    setAmountA(out > 0 && isFinite(out) ? out.toFixed(dec).replace(/\.?0+$/, '') : '0');
                }
            }
        };

        // Debounce the on-chain call
        const timeoutId = setTimeout(calculateOnChain, 300);
        return () => clearTimeout(timeoutId);
    // NOTE: amountB is intentionally excluded from deps to avoid infinite loops.
    // B→A only fires when amountA is empty and priceLower/priceUpper changes —
    // the effect reads amountB via closure but doesn't react to its own output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [poolType, clPoolPrice, clPoolAddress, initialPrice, amountA, priceLower, priceUpper, isAToken0, actualTokenA, actualTokenB, tickSpacing]);

    // Handle V2 liquidity add
    const handleAddLiquidity = async () => {
        if (!tokenA || !tokenB || !amountA || !amountB) return;

        const result = await addLiquidity(tokenA, tokenB, amountA, amountB, stable);

        if (result) {
            setTxHash(result.hash);
            setAmountA('');
            setAmountB('');
            setTxProgress('done');
        }
    };

    // Handle CL liquidity add
    const handleAddCLLiquidity = async () => {
        // Prevent multiple submissions
        if (txProgress !== 'idle' && txProgress !== 'done' && txProgress !== 'error') {
            console.log('Transaction already in progress, skipping');
            return;
        }

        if (!tokenA || !tokenB || !address) {
            return;
        }

        // For CL single-sided LP, one amount can be 0 or empty
        const amtA = parseFloat(amountA || '0');
        const amtB = parseFloat(amountB || '0');

        // For CL, single-sided liquidity is allowed when price range is outside current price
        // At least one amount must be positive
        if (isNaN(amtA) || isNaN(amtB) || (amtA <= 0 && amtB <= 0)) {
            toast.error('Please enter a valid amount for at least one token');
            return;
        }

        if (!clPoolPrice && (!initialPrice || parseFloat(initialPrice) <= 0)) {
            toast.error('Please set the initial price for this new pool');
            return;
        }

        // Set state to block re-entry
        setTxProgress('approving0');
        setTxError(null);

        try {
            const actualTokenA = tokenA.isNative ? WETH : tokenA;
            const actualTokenB = tokenB.isNative ? WETH : tokenB;

            const isAFirst = actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase();
            const token0 = isAFirst ? actualTokenA : actualTokenB;
            const token1 = isAFirst ? actualTokenB : actualTokenA;
            const amount0 = isAFirst ? amountA : amountB;
            const amount1 = isAFirst ? amountB : amountA;

            // Safe parseUnits that truncates extra decimals to prevent errors
            const safeParseUnits = (value: string, decimals: number): bigint => {
                if (!value || parseFloat(value) <= 0) return BigInt(0);
                // Truncate to max decimals the token supports
                const parts = value.split('.');
                if (parts.length === 2 && parts[1].length > decimals) {
                    value = parts[0] + '.' + parts[1].slice(0, decimals);
                }
                try {
                    return parseUnits(value, decimals);
                } catch (e) {
                    console.error('parseUnits error:', e, { value, decimals });
                    return BigInt(0);
                }
            };

            // Handle 0 amounts gracefully with safe parsing
            const amount0Wei = safeParseUnits(amount0 || '0', token0.decimals);
            const amount1Wei = safeParseUnits(amount1 || '0', token1.decimals);

            // Use imported priceToTick for consistent tick calculations
            let tickLower: number;
            let tickUpper: number;

            if (priceLower && priceUpper && parseFloat(priceLower) > 0 && parseFloat(priceUpper) > 0) {
                tickLower = priceToTick(
                    parseFloat(priceLower),
                    token0.decimals,
                    token1.decimals,
                    tickSpacing,
                    isAFirst // isToken0Base
                );
                tickUpper = priceToTick(
                    parseFloat(priceUpper),
                    token0.decimals,
                    token1.decimals,
                    tickSpacing,
                    isAFirst
                );
                if (tickLower > tickUpper) {
                    [tickLower, tickUpper] = [tickUpper, tickLower];
                }
                // Ensure ticks are at least one tick spacing apart
                if (tickUpper - tickLower < tickSpacing) {
                    tickUpper = tickLower + tickSpacing;
                }
            } else {
                const maxTick = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
                tickLower = -maxTick;
                tickUpper = maxTick;
            }

            console.log('Tick calculation:', { tickLower, tickUpper, tickSpacing, priceLower, priceUpper });

            const deadline = getDeadline();

            // Check if pool exists
            const tickSpacingHex = tickSpacing >= 0
                ? tickSpacing.toString(16).padStart(64, '0')
                : (BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') + BigInt(tickSpacing) + BigInt(1)).toString(16);
            const poolCheckData = `0x28af8d0b${token0.address.slice(2).padStart(64, '0')}${token1.address.slice(2).padStart(64, '0')}${tickSpacingHex}`;

            let poolExists = false;
            try {
                const poolResult = await fetch(getRpcForPoolData(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [{ to: CL_CONTRACTS.CLFactory, data: poolCheckData }, 'latest'],
                        id: 1
                    })
                }).then(r => r.json());

                poolExists = poolResult.result && poolResult.result !== '0x0000000000000000000000000000000000000000000000000000000000000000';
            } catch (err) {
                poolExists = false;
            }

            let sqrtPriceX96 = BigInt(0);
            if (!poolExists) {
                // New pool - calculate sqrtPriceX96 from initial price
                let rawPrice: number;

                if (initialPrice && parseFloat(initialPrice) > 0) {
                    const userPrice = parseFloat(initialPrice);
                    if (isAFirst) {
                        rawPrice = userPrice * Math.pow(10, token1.decimals) / Math.pow(10, token0.decimals);
                    } else {
                        rawPrice = (1 / userPrice) * Math.pow(10, token1.decimals) / Math.pow(10, token0.decimals);
                    }
                } else {
                    rawPrice = Number(amount1Wei) / Number(amount0Wei);
                }

                const Q96 = BigInt(2) ** BigInt(96);
                const sqrtPriceFloat = Math.sqrt(rawPrice);
                const sqrtPriceScaled = sqrtPriceFloat * Number(Q96);
                sqrtPriceX96 = BigInt(Math.floor(sqrtPriceScaled));
            }
            // For existing pools, sqrtPriceX96 stays as 0 - the contract ignores it

            // Determine which tokens are native
            const token0IsNative = (tokenA.isNative && token0.address.toLowerCase() === WETH.address.toLowerCase()) ||
                (tokenB.isNative && token0.address.toLowerCase() === WETH.address.toLowerCase());
            const token1IsNative = (tokenA.isNative && token1.address.toLowerCase() === WETH.address.toLowerCase()) ||
                (tokenB.isNative && token1.address.toLowerCase() === WETH.address.toLowerCase());

            // Calculate native value - simple check for native tokens
            let nativeValue = BigInt(0);
            if (tokenA.isNative || tokenB.isNative) {
                if (token0.address.toLowerCase() === WETH.address.toLowerCase()) {
                    nativeValue = amount0Wei;
                } else if (token1.address.toLowerCase() === WETH.address.toLowerCase()) {
                    nativeValue = amount1Wei;
                }
            }

            // 5% slippage tolerance for CL positions.
            // CL amounts are determined by the exact on-chain tick at mint time, which can
            // shift between UI calculation and mining. 1% was too tight and caused PSC reverts
            // when the tick moved naturally (e.g. near the edge of the selected range).
            const amount0Min = (amount0Wei * BigInt(95)) / BigInt(100);
            const amount1Min = (amount1Wei * BigInt(95)) / BigInt(100);

            console.log('CL Mint params:', {
                token0: token0.address,
                token1: token1.address,
                tickSpacing,
                tickLower,
                tickUpper,
                amount0Desired: amount0Wei.toString(),
                amount1Desired: amount1Wei.toString(),
                amount0Min: amount0Min.toString(),
                amount1Min: amount1Min.toString(),
                sqrtPriceX96: sqrtPriceX96.toString(),
                poolExists,
                nativeValue: nativeValue.toString(),
            });

            // Build approval calls if needed (skip native tokens)
            const approve0Call = token0IsNative ? null : await buildApproveCallIfNeeded(token0.address as Address, CL_CONTRACTS.NonfungiblePositionManager as Address, amount0Wei);
            const approve1Call = token1IsNative ? null : await buildApproveCallIfNeeded(token1.address as Address, CL_CONTRACTS.NonfungiblePositionManager as Address, amount1Wei);

            // Build batch calls: approve token0 (if needed) + approve token1 (if needed) + mint
            const batchCalls = [approve0Call, approve1Call].filter((c): c is NonNullable<typeof c> => c !== null);

            // Mint NFT call
            const mintCall = encodeContractCall(
                CL_CONTRACTS.NonfungiblePositionManager as Address,
                NFT_POSITION_MANAGER_ABI,
                'mint',
                [{
                    token0: token0.address as Address,
                    token1: token1.address as Address,
                    tickSpacing,
                    tickLower,
                    tickUpper,
                    amount0Desired: amount0Wei,
                    amount1Desired: amount1Wei,
                    amount0Min,
                    amount1Min,
                    recipient: address,
                    deadline,
                    sqrtPriceX96,
                }],
                nativeValue
            );
            batchCalls.push(mintCall);

            // NOTE: Do NOT add NFT approve+deposit to the same batch as mint.
            // Wallets simulate calls against current state, so approving a token ID
            // that doesn't exist yet causes simulation failure ("Fail to estimate gas").
            // Auto-stake is handled separately after mint confirms (see below).

            // Try EIP-5792 batch first
            setTxProgress('minting');
            const mintHash = await batchOrSequential(batchCalls);
            console.log('Transaction successful:', mintHash);

            setTxHash(mintHash);
            toast.success('Liquidity position created successfully!');

            // If auto-stake is enabled and this pool has a gauge, stake the NFT
            // NOTE: staking errors are caught separately — a failed stake does NOT
            // roll back the successfully minted position.
            if (autoStake && gaugeAddress) {
                try {
                    // Wait for mint transaction to confirm and get the tokenId from logs
                    let tokenId: bigint | null = null;
                    for (let i = 0; i < 30; i++) {
                        const receipt = await fetch(getRpcForPoolData(), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0', method: 'eth_getTransactionReceipt',
                                params: [mintHash],
                                id: 1
                            })
                        }).then(r => r.json());

                        if (receipt.result && receipt.result.status === '0x1') {
                            // Parse logs to find Transfer event (NFT mint)
                            // Transfer event signature: Transfer(address,address,uint256)
                            const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
                            const transferLog = receipt.result.logs?.find((log: any) =>
                                log.topics[0] === transferTopic &&
                                log.address.toLowerCase() === CL_CONTRACTS.NonfungiblePositionManager.toLowerCase()
                            );
                            if (transferLog && transferLog.topics[3]) {
                                tokenId = BigInt(transferLog.topics[3]);
                            }
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    if (tokenId) {
                        // Try to batch approve NFT + stake together
                        const nftApproveCall = encodeContractCall(
                            CL_CONTRACTS.NonfungiblePositionManager as Address,
                            [{ inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function' }],
                            'approve',
                            [gaugeAddress as Address, tokenId]
                        );

                        const stakeCall = encodeContractCall(
                            gaugeAddress as Address,
                            [{ inputs: [{ name: 'tokenId', type: 'uint256' }], name: 'deposit', outputs: [], stateMutability: 'nonpayable', type: 'function' }],
                            'deposit',
                            [tokenId]
                        );

                        setTxProgress('staking');
                        await batchOrSequential([nftApproveCall, stakeCall]);
                        toast.success('Position staked! Earning WIND rewards');
                    }
                } catch (stakeErr: unknown) {
                    // Staking failed (user rejected, network error, etc.)
                    // LP position was already created — do NOT mark the whole flow as failed.
                    console.warn('Auto-stake failed (position still created):', stakeErr);
                    const msg = stakeErr instanceof Error ? stakeErr.message : '';
                    const isRejected = /rejected|denied|cancelled|cancel/i.test(msg);
                    toast.error(
                        isRejected
                            ? 'Staking cancelled. Your LP position was created — stake it from Portfolio anytime.'
                            : 'Staking failed. Your LP position was created — stake it from Portfolio anytime.'
                    );
                }
            }

            setAmountA('');
            setAmountB('');
            setTxProgress('done');
        } catch (err: unknown) {
            console.error('CL mint error:', err);
            setTxProgress('error');
            setTxError(extractErrorMessage(err, 'Transaction failed'));
        }
    };

    // Move a price boundary by exactly ONE tick in the given direction.
    // Steps are 1 tick (~0.01% per step) regardless of tickSpacing.
    // The mint code snaps to tickSpacing at submit time — fine granularity here is intentional.
    // Direction is corrected for pool token ordering: when !isAToken0 the pool tick and
    // UI price are inversely related, so the logical direction must be flipped.
    const adjustPriceByOneTick = (price: number, direction: 1 | -1): number => {
        if (!actualTokenA || !actualTokenB) return price;
        const t0Dec = isAToken0 ? actualTokenA.decimals : actualTokenB.decimals;
        const t1Dec = isAToken0 ? actualTokenB.decimals : actualTokenA.decimals;
        const poolPrice = isAToken0 ? price : 1 / price;
        const adjustedPrice = poolPrice * Math.pow(10, t1Dec - t0Dec);
        const rawTick = Math.log(adjustedPrice) / Math.log(1.0001);
        const alignedTick = Math.round(rawTick / tickSpacing) * tickSpacing;
        // Invert tick direction when pool ordering is opposite to UI ordering
        const tickDir = isAToken0 ? direction : -direction as 1 | -1;
        const newTick = alignedTick + tickDir * tickSpacing;
        return tickToPrice(newTick, t0Dec, t1Dec, isAToken0);
    };

    const setPresetRange = (percent: number) => {
        const currentPrice = clPoolPrice ?? (initialPrice ? parseFloat(initialPrice) : null);
        if (currentPrice) {
            setPriceLower((currentPrice * (1 - percent / 100)).toFixed(6));
            setPriceUpper((currentPrice * (1 + percent / 100)).toFixed(6));
        }
    };

    // Check if we're in the middle of a CL transaction
    const isCLInProgress = txProgress !== 'idle' && txProgress !== 'done' && txProgress !== 'error';

    const canAdd = isConnected &&
        tokenA &&
        tokenB &&
        (poolType === 'cl'
            ? (parseFloat(amountA || '0') > 0 || parseFloat(amountB || '0') > 0) // CL allows single-sided
            : (amountA && parseFloat(amountA) > 0 && parseFloat(amountB || '0') > 0)) && // V2 needs both
        !isCLInProgress;

    const poolExists = clPoolPrice !== null;

    // Check if pool config is pre-defined (clicking Add LP on existing pool)
    const isPoolPreConfigured = !!(initialPool?.token0 && initialPool?.token1);

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="modal-backdrop"
                        className={mobileStyles.overlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                            onClick={onClose}
                        />

                        {/* Modal - Bottom sheet on mobile, centered on desktop */}
                        <motion.div
                            key="modal-content"
                            className={mobileStyles.modal}
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        >
                            {/* Sticky Header */}
                            <div className={mobileStyles.header}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-lg sm:text-xl font-bold">Add Liquidity</h2>
                                        <p className="text-xs text-gray-400 hidden sm:block">Deposit tokens to earn fees</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className={mobileStyles.scrollArea}>
                                {/* Error Display */}
                                {error && (
                                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                        <div className="flex items-start gap-3">
                                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <span className="text-red-400 text-xs">!</span>
                                            </div>
                                            <p className="text-red-400 text-sm">{error}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Success Display */}
                                {txHash && txProgress === 'done' && (
                                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-green-400 font-medium">Liquidity Added!</p>
                                                <a
                                                    href={`https://basescan.org/tx/${txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-green-400/70 underline truncate block"
                                                >
                                                    View on Etherscan →
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pool Info + Price - combined single row */}
                                {isPoolPreConfigured && (
                                    <div className="p-2 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="flex -space-x-1 flex-shrink-0">
                                                    {tokenA?.logoURI && (
                                                        <img src={tokenA.logoURI} alt="" className="w-5 h-5 rounded-full border border-[#0d0d14]" />
                                                    )}
                                                    {tokenB?.logoURI && (
                                                        <img src={tokenB.logoURI} alt="" className="w-5 h-5 rounded-full border border-[#0d0d14]" />
                                                    )}
                                                </div>
                                                <span className="font-semibold text-xs truncate">{tokenA?.symbol}/{tokenB?.symbol}</span>
                                                <span className="text-[10px] text-gray-400 flex-shrink-0">
                                                    {poolType === 'cl' ? ({ 1: '0.005%', 2: '1%', 10: '0.05%', 50: '0.02%', 80: '0.30%', 100: '0.045%', 200: '0.25%', 2000: '1%' }[tickSpacing] || `${tickSpacing}ts`) : (stable ? 'S' : 'V')}
                                                </span>
                                            </div>
                                            {poolType === 'cl' && clPoolPrice && (
                                                <div className="text-[10px] text-gray-400 flex-shrink-0">
                                                    <span className="text-green-400">●</span> 1={formatSmartPrice(clPoolPrice)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}


                                {/* Pool Type Selection - only show when creating new pool */}
                                {!isPoolPreConfigured && (
                                    <div>
                                        <label className="text-sm text-gray-400 mb-3 block font-medium">Pool Type</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setPoolType('v2')}
                                                className={`p-4 rounded-xl text-center transition-all active:scale-[0.98] ${poolType === 'v2'
                                                    ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/50 shadow-lg shadow-primary/10'
                                                    : 'bg-white/5 border border-white/10 hover:bg-white/8'
                                                    }`}
                                            >
                                                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                    </svg>
                                                </div>
                                                <div className="font-semibold mb-1">Classic V2</div>
                                                <div className="text-xs text-gray-400">Simple 50/50</div>
                                            </button>
                                            <button
                                                onClick={() => setPoolType('cl')}
                                                className={`p-4 rounded-xl text-center transition-all active:scale-[0.98] ${poolType === 'cl'
                                                    ? 'bg-gradient-to-br from-secondary/20 to-cyan-500/10 border-2 border-secondary/50 shadow-lg shadow-secondary/10'
                                                    : 'bg-white/5 border border-white/10 hover:bg-white/8'
                                                    }`}
                                            >
                                                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                                                    <span className="text-2xl"></span>
                                                </div>
                                                <div className="font-semibold mb-1">Concentrated</div>
                                                <div className="text-xs text-gray-400">Higher yields</div>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* V2 Stable/Volatile Toggle - only show when creating new V2 pool */}
                                {poolType === 'v2' && !isPoolPreConfigured && (
                                    <div>
                                        <label className="text-sm text-gray-400 mb-3 block font-medium">Pool Curve</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setStable(false)}
                                                className={`py-4 px-4 rounded-xl text-center font-medium transition-all active:scale-[0.98] ${!stable
                                                    ? 'bg-primary/15 border-2 border-primary/40 text-white'
                                                    : 'bg-white/5 border border-white/10 hover:bg-white/8 text-gray-300'
                                                    }`}
                                            >
                                                <span className="block text-lg mb-1"></span>
                                                Volatile
                                            </button>
                                            <button
                                                onClick={() => setStable(true)}
                                                className={`py-4 px-4 rounded-xl text-center font-medium transition-all active:scale-[0.98] ${stable
                                                    ? 'bg-primary/15 border-2 border-primary/40 text-white'
                                                    : 'bg-white/5 border border-white/10 hover:bg-white/8 text-gray-300'
                                                    }`}
                                            >
                                                <span className="block text-lg mb-1"></span>
                                                Stable
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* CL Fee Tier - only show when creating new CL pool */}
                                {poolType === 'cl' && !isPoolPreConfigured && (
                                    <div>
                                        <label className="text-sm text-gray-400 mb-3 block font-medium">Fee Tier</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                            {[
                                                { spacing: 1, fee: '0.005%', best: 'Stables' },
                                                { spacing: 3, fee: '0.03%', best: 'Standard' },
                                                { spacing: 4, fee: '0.05%', best: 'Medium' },
                                                { spacing: 5, fee: '0.26%', best: 'Volatile' },
                                                { spacing: 2, fee: '1%', best: 'Exotic' },
                                            ].map(({ spacing, fee, best }) => (
                                                <button
                                                    key={spacing}
                                                    onClick={() => setTickSpacing(spacing)}
                                                    className={`p-3 sm:p-2 rounded-xl text-center transition-all active:scale-[0.98] ${tickSpacing === spacing
                                                        ? 'bg-secondary/15 border-2 border-secondary/40 text-white'
                                                        : 'bg-white/5 border border-white/10 hover:bg-white/8'
                                                        }`}
                                                >
                                                    <div className="text-base sm:text-sm font-bold">{fee}</div>
                                                    <div className="text-xs text-gray-400 mt-1 hidden sm:block">{best}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* CL Price Range */}
                                {poolType === 'cl' && (
                                    <div className="space-y-3">
                                        {/* New Pool - Initial Price Input (only if no pool exists) */}
                                        {!poolExists && (
                                            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-yellow-400 text-xs">New Pool</span>
                                                    <div className="flex-1 flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                                                        <span className="text-gray-400 text-xs">1 {tokenA?.symbol} =</span>
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            value={initialPrice}
                                                            onChange={(e) => setInitialPrice(e.target.value)}
                                                            placeholder="0.0"
                                                            className="flex-1 min-w-0 bg-transparent text-sm font-bold text-center outline-none placeholder-gray-600"
                                                        />
                                                        <span className="text-gray-400 text-xs">{tokenB?.symbol}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Range Strategy Selection - Compact */}
                                        <div>
                                            <div className="text-xs text-gray-400 mb-2 font-medium">Range</div>
                                            {(() => {
                                                // Calculate current range percentage
                                                const rangePercent = currentPrice && priceLower && priceUpper
                                                    ? Math.round(((parseFloat(priceUpper) - currentPrice) / currentPrice) * 100)
                                                    : null;
                                                const isFullRange = !priceLower && !priceUpper;

                                                // Stablecoin pools use tickSpacing 1 (0.005%)
                                                const isStablecoinPool = tickSpacing === 1;

                                                // Different presets based on pool type
                                                // Stablecoins: no Full range, use tight percentages
                                                // Volatile: keep Full range option
                                                const presets = isStablecoinPool
                                                    ? [0.1, 0.2, 0.5, 1] // Very tight ranges for stablecoins (1:1 pegged)
                                                    : [2, 10, 50]; // Wider ranges for volatile

                                                return (
                                                    <div className={`grid gap-1.5 ${isStablecoinPool ? 'grid-cols-4' : 'grid-cols-4'}`}>
                                                        {/* Only show Full range for non-stablecoin pools */}
                                                        {!isStablecoinPool && (
                                                            <button
                                                                onClick={() => { setPriceLower(''); setPriceUpper(''); }}
                                                                className={`py-2 px-1 rounded-lg text-center transition-all active:scale-[0.98] ${isFullRange
                                                                    ? 'bg-gradient-to-br from-primary/30 to-secondary/30 border border-primary/50'
                                                                    : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
                                                            >
                                                                <div className="text-xs font-bold">Full</div>
                                                            </button>
                                                        )}
                                                        {presets.map(pct => {
                                                            const isActive = rangePercent !== null && Math.abs(rangePercent - pct) < 0.5;
                                                            return (
                                                                <button
                                                                    key={pct}
                                                                    onClick={() => setPresetRange(pct)}
                                                                    disabled={!currentPrice}
                                                                    className={`py-2 px-1 rounded-lg text-center transition-all active:scale-[0.98] ${isActive
                                                                        ? 'bg-gradient-to-br from-primary/30 to-secondary/30 border border-primary/50'
                                                                        : currentPrice
                                                                            ? 'bg-white/5 hover:bg-white/10 border border-white/10'
                                                                            : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'}`}
                                                                >
                                                                    <div className="text-xs font-bold">±{pct}%</div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}

                                            {/* Single-Sided LP Presets */}
                                            {currentPrice && tokenA && tokenB && (() => {
                                                // Determine sorted token order for correct labeling
                                                const actualTokenA = tokenA.isNative ? WETH : tokenA;
                                                const actualTokenB = tokenB.isNative ? WETH : tokenB;
                                                const isAToken0 = actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase();
                                                // CORRECT Uniswap V3 CL Math:
                                                // When range is ABOVE current: deposit token0 (lower sorted address)
                                                // When range is BELOW current: deposit token1 (higher sorted address)
                                                const aboveToken = isAToken0 ? tokenA : tokenB; // token0
                                                const belowToken = isAToken0 ? tokenB : tokenA; // token1

                                                // Determine range based on tick spacing
                                                // Stable pairs (tick 1) = tight range (0.5%)
                                                // Standard pairs (tick 3) = medium range (3%)
                                                // Medium pairs (tick 4) = medium range (5%)
                                                // Volatile pairs (tick 5) = wider range (5%)
                                                // Exotic pairs (tick 2) = wide range (10%)
                                                const rangeLabel =tickSpacing === 1 ? '±0.5%' : tickSpacing === 3 ? '±3%' : tickSpacing === 4 ? '±5%' : tickSpacing === 5 ? '±5%' : tickSpacing === 2 ? '±10%' : '±10%';

                                                return (
                                                    <div className="mt-3">
                                                        <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                                                            One-Sided LP ({rangeLabel} range)
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    if (currentTickForLens == null || !actualTokenA || !actualTokenB) return;
                                                                    const t0Dec = isAToken0 ? actualTokenA.decimals : actualTokenB.decimals;
                                                                    const t1Dec = isAToken0 ? actualTokenB.decimals : actualTokenA.decimals;
                                                                    // Align current tick to tickSpacing grid
                                                                    const alignedTick = Math.floor(currentTickForLens / tickSpacing) * tickSpacing;
                                                                    // Place range from current tick to 100 ticks above
                                                                    const lowerTick = alignedTick + tickSpacing;
                                                                    const upperTick = alignedTick + tickSpacing * 100;
                                                                    setPriceLower(tickToPrice(lowerTick, t0Dec, t1Dec, isAToken0).toFixed(8));
                                                                    setPriceUpper(tickToPrice(upperTick, t0Dec, t1Dec, isAToken0).toFixed(8));
                                                                    if (isAToken0) {
                                                                        setAmountA('');
                                                                        setAmountB('0');
                                                                    } else {
                                                                        setAmountA('0');
                                                                        setAmountB('');
                                                                    }
                                                                }}
                                                                className="py-2.5 px-2 rounded-lg text-center transition-all active:scale-[0.98] bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/30 hover:border-green-500/50"
                                                            >
                                                                <div className="text-xs font-bold text-green-400">↑ Above Current</div>
                                                                <div className="text-[9px] text-gray-500 mt-0.5">Only {aboveToken.symbol}</div>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (currentTickForLens == null || !actualTokenA || !actualTokenB) return;
                                                                    const t0Dec = isAToken0 ? actualTokenA.decimals : actualTokenB.decimals;
                                                                    const t1Dec = isAToken0 ? actualTokenB.decimals : actualTokenA.decimals;
                                                                    // Align current tick to tickSpacing grid
                                                                    const alignedTick = Math.floor(currentTickForLens / tickSpacing) * tickSpacing;
                                                                    // Place range from 100 ticks below to current tick
                                                                    const lowerTick = alignedTick - tickSpacing * 100;
                                                                    const upperTick = alignedTick;
                                                                    setPriceLower(tickToPrice(lowerTick, t0Dec, t1Dec, isAToken0).toFixed(8));
                                                                    setPriceUpper(tickToPrice(upperTick, t0Dec, t1Dec, isAToken0).toFixed(8));
                                                                    if (isAToken0) {
                                                                        setAmountA('0');
                                                                        setAmountB('');
                                                                    } else {
                                                                        setAmountA('');
                                                                        setAmountB('0');
                                                                    }
                                                                }}
                                                                className="py-2.5 px-2 rounded-lg text-center transition-all active:scale-[0.98] bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/30 hover:border-red-500/50"
                                                            >
                                                                <div className="text-xs font-bold text-red-400">↓ Below Current</div>
                                                                <div className="text-[9px] text-gray-500 mt-0.5">Only {belowToken.symbol}</div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Visual Price Range Display with Draggable Slider */}
                                        {(priceLower || priceUpper) && currentPrice && (
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs text-gray-400 font-medium">Your Range</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-primary">
                                                            {priceLower && priceUpper ?
                                                                `±${(((parseFloat(priceUpper) - currentPrice) / currentPrice) * 100).toFixed(0)}%`
                                                                : 'Custom'}
                                                        </span>
                                                        {/* Range-Adjusted APR Display */}
                                                        {(() => {
                                                            if (!clPoolAddress) return null;
                                                            const rewardRate = poolRewards.get(clPoolAddress.toLowerCase());
                                                            if (!rewardRate || rewardRate === BigInt(0)) return null;

                                                            // Find pool data to get actual TVL
                                                            const pool = allPools.find(p => p.address.toLowerCase() === clPoolAddress.toLowerCase());
                                                            const tvlUsd = pool ? (parseFloat(pool.tvl) || 1) : 1;

                                                            // Get base pool APR (full-range, no concentration)
                                                            const poolAPR = calculatePoolAPR(rewardRate, windPrice, tvlUsd, undefined);

                                                            // Calculate tick-based range-adjusted APR
                                                            const pLow = parseFloat(priceLower || '0');
                                                            const pHigh = parseFloat(priceUpper || '0');

                                                            if (pLow > 0 && pHigh > 0 && pLow < pHigh && currentPrice) {
                                                                // Convert prices to ticks: tick = log(price) / log(1.0001)
                                                                const LOG_1_0001 = Math.log(1.0001);
                                                                const tickLow = Math.floor(Math.log(pLow) / LOG_1_0001);
                                                                const tickHigh = Math.ceil(Math.log(pHigh) / LOG_1_0001);
                                                                const positionWidthTicks = tickHigh - tickLow;

                                                                // Full range = 1,774,544 ticks. Concentration = fullRange / positionWidth
                                                                const FULL_RANGE_TICKS = 1774544;
                                                                const rangeMultiplier = positionWidthTicks > 0
                                                                    ? Math.max(1, Math.min(FULL_RANGE_TICKS / positionWidthTicks, 5000))
                                                                    : 1;

                                                                const rangeAdjustedAPR = poolAPR * rangeMultiplier;

                                                                return (
                                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 border border-green-500/40">
                                                                        APR {formatAPR(rangeAdjustedAPR)}
                                                                    </span>
                                                                );
                                                            }

                                                            // Fallback to base pool APR if no range selected
                                                            return (
                                                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 border border-green-500/40">
                                                                    🔥 APR {formatAPR(poolAPR)}
                                                                </span>
                                                            );
                                                        })()}


                                                    </div>
                                                </div>

                                                {/* Liquidity Depth Chart */}
                                                <LiquidityDepthChart
                                                    bars={tickLensBars}
                                                    loading={tickLensLoading}
                                                    currentTick={currentTickForLens}
                                                    tickSpacing={tickSpacing}
                                                    token0Decimals={isAToken0 ? (actualTokenA?.decimals || 18) : (actualTokenB?.decimals || 18)}
                                                    token1Decimals={isAToken0 ? (actualTokenB?.decimals || 18) : (actualTokenA?.decimals || 18)}
                                                    isToken0Base={isAToken0}
                                                    priceLower={priceLower ? parseFloat(priceLower) : undefined}
                                                    priceUpper={priceUpper ? parseFloat(priceUpper) : undefined}
                                                />

                                                {/* Draggable Range Slider */}
                                                <div className="relative h-10 mb-4">
                                                    {/* Track background */}
                                                    <div className="absolute top-1/2 left-0 right-0 h-2 bg-white/10 rounded-full -translate-y-1/2" />

                                                    {/* Active range (colored part) */}
                                                    {(() => {
                                                        const lower = parseFloat(priceLower || '0');
                                                        const upper = parseFloat(priceUpper || String(currentPrice * 2));
                                                        const minRange = currentPrice * 0.5;
                                                        const maxRange = currentPrice * 2;
                                                        const leftPercent = Math.max(0, Math.min(100, ((lower - minRange) / (maxRange - minRange)) * 100));
                                                        const rightPercent = Math.max(0, Math.min(100, ((upper - minRange) / (maxRange - minRange)) * 100));
                                                        return (
                                                            <div
                                                                className="absolute top-1/2 h-2 bg-gradient-to-r from-primary via-green-400 to-secondary rounded-full -translate-y-1/2"
                                                                style={{ left: `${leftPercent}%`, right: `${100 - rightPercent}%` }}
                                                            />
                                                        );
                                                    })()}

                                                    {/* Current price marker */}
                                                    {(() => {
                                                        const minRange = currentPrice * 0.5;
                                                        const maxRange = currentPrice * 2;
                                                        const currentPercent = Math.max(0, Math.min(100, ((currentPrice - minRange) / (maxRange - minRange)) * 100));
                                                        return (
                                                            <div
                                                                className="absolute top-1/2 w-1 h-4 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 z-10"
                                                                style={{ left: `${currentPercent}%` }}
                                                            >
                                                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 whitespace-nowrap">
                                                                    Current
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Lower bound thumb (draggable) */}
                                                    <input
                                                        type="range"
                                                        min={currentPrice * 0.5}
                                                        max={currentPrice * 2}
                                                        step={currentPrice * 0.01}
                                                        value={parseFloat(priceLower || String(currentPrice * 0.5))}
                                                        onChange={(e) => setPriceLower(parseFloat(e.target.value).toFixed(6))}
                                                        className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-grab z-20"
                                                    />

                                                    {/* Upper bound thumb (draggable) */}
                                                    <input
                                                        type="range"
                                                        min={currentPrice * 0.5}
                                                        max={currentPrice * 2}
                                                        step={currentPrice * 0.01}
                                                        value={parseFloat(priceUpper || String(currentPrice * 1.5))}
                                                        onChange={(e) => setPriceUpper(parseFloat(e.target.value).toFixed(6))}
                                                        className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-green-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-grab z-20"
                                                    />
                                                </div>

                                                {/* Min/Max with +/- buttons and percentage */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="text-center">
                                                        <div className="flex items-center justify-center gap-2 mb-1">
                                                            <span className="text-xs text-red-400">Min Price</span>
                                                            {priceLower && currentPrice && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                                                    {(((parseFloat(priceLower) - currentPrice) / currentPrice) * 100).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => { const p = parseFloat(priceLower || '0'); if (p > 0) setPriceLower(formatSmartPrice(adjustPriceByOneTick(p, -1))); }}
                                                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg"
                                                            >−</button>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={priceLower || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                                                        setPriceLower(val);
                                                                    }
                                                                }}
                                                                className="font-bold text-lg min-w-[80px] max-w-[120px] text-center bg-transparent border border-white/10 rounded-lg px-1 py-0.5 focus:border-primary/50 focus:outline-none"
                                                                placeholder="0"
                                                            />
                                                            <button
                                                                onClick={() => { const p = parseFloat(priceLower || '0'); if (p > 0) setPriceLower(formatSmartPrice(adjustPriceByOneTick(p, 1))); }}
                                                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg"
                                                            >+</button>
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="flex items-center justify-center gap-2 mb-1">
                                                            <span className="text-xs text-green-400">Max Price</span>
                                                            {priceUpper && currentPrice && (() => {
                                                                const pct = ((parseFloat(priceUpper) - currentPrice) / currentPrice) * 100;
                                                                const isPositive = pct >= 0;
                                                                return (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                        {isPositive ? '+' : ''}{pct.toFixed(1)}%
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => { const p = parseFloat(priceUpper || '0'); if (p > 0) setPriceUpper(formatSmartPrice(adjustPriceByOneTick(p, -1))); }}
                                                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg"
                                                            >−</button>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={priceUpper || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                                                        setPriceUpper(val);
                                                                    }
                                                                }}
                                                                className="font-bold text-lg min-w-[80px] max-w-[120px] text-center bg-transparent border border-white/10 rounded-lg px-1 py-0.5 focus:border-primary/50 focus:outline-none"
                                                                placeholder="Max"
                                                            />
                                                            <button
                                                                onClick={() => { const p = parseFloat(priceUpper || '0'); if (p > 0) setPriceUpper(formatSmartPrice(adjustPriceByOneTick(p, 1))); }}
                                                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg"
                                                            >+</button>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        )}

                                    </div>
                                )}

                                {/* Token Inputs */}
                                {<div className="space-y-0.5">
                                        {/* Token A */}
                                        <div className={`p-3 rounded-lg border ${depositTokenAForOneSided ? 'bg-green-500/5 border-green-500/30' : depositTokenBForOneSided ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/10'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs text-gray-400">
                                                    {depositTokenAForOneSided ? (
                                                        <span className="text-green-400">You Deposit</span>
                                                    ) : depositTokenBForOneSided ? (
                                                        <span className="text-gray-500">Not needed (0)</span>
                                                    ) : 'You Deposit'}
                                                </label>
                                                <span className="text-[10px] text-gray-400">
                                                    Bal: {balanceA ? parseFloat(balanceA).toFixed(4) : '--'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={amountA}
                                                    onChange={(e) => !depositTokenBForOneSided && setAmountA(e.target.value)}
                                                    readOnly={depositTokenBForOneSided}
                                                    placeholder={depositTokenBForOneSided ? '0' : '0.0'}
                                                    className={`flex-1 min-w-0 bg-transparent text-xl font-bold outline-none placeholder-gray-600 ${depositTokenBForOneSided ? 'text-gray-400' : ''}`}
                                                />
                                                <button
                                                    onClick={() => setSelectorOpen('A')}
                                                    className="flex items-center gap-1.5 py-1.5 px-2 bg-white/10 hover:bg-white/15 rounded-lg transition-colors flex-shrink-0"
                                                >
                                                    {tokenA && tokenA.logoURI && (
                                                        <img src={tokenA.logoURI} alt="" className="w-5 h-5 rounded-full" />
                                                    )}
                                                    <span className="font-semibold text-sm">{tokenA?.symbol || 'Select'}</span>
                                                </button>
                                            </div>
                                            {/* Quick percentage buttons - only show when it's the deposit token */}
                                            {rawBalanceA && parseFloat(rawBalanceA) > 0 && !depositTokenBForOneSided && (
                                                <div className="flex gap-1 mt-2">
                                                    {[25, 50, 75, 100].map(pct => (
                                                        <button
                                                            key={pct}
                                                            onClick={() => {
                                                                if (pct === 100) {
                                                                    setAmountA(rawBalanceA);
                                                                } else {
                                                                    const calc = bigIntPercentage(rawBigIntA, pct);
                                                                    setAmountA(formatUnits(calc, tokenA?.decimals ?? 18));
                                                                }
                                                            }}
                                                            className="flex-1 py-1 text-[10px] font-medium rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                        >
                                                            {pct === 100 ? 'MAX' : `${pct}%`}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>



                                        {/* Token B */}
                                        <div className={`p-3 rounded-lg border ${depositTokenBForOneSided ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs text-gray-400">
                                                    {depositTokenBForOneSided ? (
                                                        <span className="text-green-400">You Deposit</span>
                                                    ) : poolType === 'cl' ? (
                                                        depositTokenAForOneSided ? <span className="text-gray-500">Not needed (0)</span> : 'You Deposit'
                                                    ) : 'You Deposit'}
                                                </label>
                                                <button
                                                    onClick={() => {
                                                        if (!rawBalanceB) return;
                                                        if (poolType !== 'cl' || depositTokenBForOneSided) {
                                                            setAmountB(rawBalanceB);
                                                        } else {
                                                            // Two-sided CL: typing B clears A so B→A fires
                                                            setAmountB(rawBalanceB);
                                                            setAmountA('');
                                                        }
                                                    }}
                                                    className="text-[10px] text-gray-400 hover:text-primary transition-colors"
                                                >
                                                    Bal: {balanceB || '--'}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={amountB}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (poolType === 'cl' && !depositTokenBForOneSided) {
                                                            // Two-sided CL: user is editing B, clear A to trigger B→A calc
                                                            setAmountB(val);
                                                            setAmountA('');
                                                        } else {
                                                            setAmountB(val);
                                                        }
                                                    }}
                                                    placeholder={poolType === 'cl' ? (depositTokenBForOneSided ? '0.0' : 'Auto') : '0.0'}
                                                    className="flex-1 min-w-0 bg-transparent text-xl font-bold outline-none placeholder-gray-600"
                                                />
                                                <button
                                                    onClick={() => setSelectorOpen('B')}
                                                    className="flex items-center gap-1.5 py-1.5 px-2 bg-white/10 hover:bg-white/15 rounded-lg transition-colors flex-shrink-0"
                                                >
                                                    {tokenB && tokenB.logoURI && (
                                                        <img src={tokenB.logoURI} alt="" className="w-5 h-5 rounded-full" />
                                                    )}
                                                    <span className="font-semibold text-sm">{tokenB?.symbol || 'Select'}</span>
                                                </button>
                                            </div>
                                            {/* Quick percentage buttons for token B */}
                                            {rawBalanceB && parseFloat(rawBalanceB) > 0 && (depositTokenBForOneSided || poolType === 'cl') && (
                                                <div className="flex gap-1 mt-2">
                                                    {[25, 50, 75, 100].map(pct => (
                                                        <button
                                                            key={pct}
                                                            onClick={() => {
                                                                const val = pct === 100
                                                                    ? rawBalanceB
                                                                    : formatUnits(bigIntPercentage(rawBigIntB, pct), tokenB?.decimals ?? 18);
                                                                setAmountB(val);
                                                                // In two-sided CL, editing B drives the calc; clear A to trigger B→A
                                                                if (poolType === 'cl' && !depositTokenBForOneSided) {
                                                                    setAmountA('');
                                                                }
                                                            }}
                                                            className="flex-1 py-1 text-[10px] font-medium rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                        >
                                                            {pct === 100 ? 'MAX' : `${pct}%`}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>}

                                {/* Auto-Stake Toggle - only show for pools with gauges */}
                                {hasGauge && poolType === 'cl' && (
                                    <div className="p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🎁</span>
                                                <div>
                                                    <span className="font-medium text-sm">Auto-Stake for WIND Rewards</span>
                                                    <p className="text-[10px] text-gray-400">Stake in gauge after adding liquidity</p>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={autoStake}
                                                    onChange={(e) => setAutoStake(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-green-500 transition-colors" />
                                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {/* Transaction Progress */}
                                {txProgress !== 'idle' && txProgress !== 'done' && (
                                    <div className={`p-4 rounded-xl ${txProgress === 'error' ? 'bg-red-500/10 border border-red-500/30' : 'bg-primary/10 border border-primary/30'}`}>
                                        <div className="flex items-center gap-3">
                                            {txProgress === 'error' ? (
                                                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-red-400 text-lg">✕</span>
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium">
                                                    {txProgress === 'approving0' && 'Approving Token 1...'}
                                                    {txProgress === 'approving1' && 'Approving Token 2...'}
                                                    {txProgress === 'minting' && 'Creating Position...'}
                                                    {txProgress === 'approving_nft' && 'Approving NFT for Staking...'}
                                                    {txProgress === 'staking' && 'Staking in Gauge...'}
                                                    {txProgress === 'error' && 'Transaction Failed'}
                                                </p>
                                                {txError && (
                                                    <p className="text-sm text-red-400 mt-1">{txError}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky Footer with Action Button */}
                            <div className={mobileStyles.footer}>
                                {(() => {
                                        // Validation & UX: Check if user is trying to provide only 1 token when range overlaps current price
                                        let invalidSingleSidedRange = false;
                                        let isTryingSingleSidedA = false;
                                        let isTryingSingleSidedB = false;

                                        if (poolType === 'cl' && currentPrice && priceLower && priceUpper) {
                                            const pLow = parseFloat(priceLower);
                                            const pHigh = parseFloat(priceUpper);
                                            const aAmt = parseFloat(amountA || '0');
                                            const bAmt = parseFloat(amountB || '0');

                                            // True if the range overlaps current price
                                            const isOverlapping = pLow <= currentPrice && currentPrice <= pHigh;

                                            // Check which token they are trying to provide solely
                                            isTryingSingleSidedA = aAmt > 0 && bAmt === 0;
                                            isTryingSingleSidedB = bAmt > 0 && aAmt === 0;

                                            if (isOverlapping && (isTryingSingleSidedA || isTryingSingleSidedB)) {
                                                invalidSingleSidedRange = true;
                                            }
                                        }

                                        // Auto-fix handler for single-sided range overlap
                                        const handleAutoFixRange = (e: React.MouseEvent) => {
                                            e.preventDefault();
                                            if (!tokenA || !tokenB || !currentPrice) return;

                                            const actualTokenA = tokenA.isNative ? WETH : tokenA;
                                            const actualTokenB = tokenB.isNative ? WETH : tokenB;
                                            const isAToken0 = actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase();

                                            const poolPrice = isAToken0 ? currentPrice : 1 / currentPrice;
                                            const adjustedPrice = poolPrice * Math.pow(10, actualTokenB.decimals - actualTokenA.decimals);
                                            const rawTick = Math.log(adjustedPrice) / Math.log(1.0001);

                                            // If they are trying to provide only TokenA (which might be token0 or token1)
                                            // Wait, if they only provide token0, range must be ABOVE current tick.
                                            // If they only provide token1, range must be BELOW current tick.
                                            let depositToken0 = isTryingSingleSidedA ? isAToken0 : !isAToken0;

                                            if (depositToken0) {
                                                // Deposit token0 -> Range must be ABOVE current tick
                                                const lowerTick = Math.ceil(rawTick / tickSpacing) * tickSpacing;
                                                const upperTick = lowerTick + tickSpacing;
                                                const lower = tickToPrice(lowerTick, actualTokenA.decimals, actualTokenB.decimals, isAToken0);
                                                const upper = tickToPrice(upperTick, actualTokenA.decimals, actualTokenB.decimals, isAToken0);
                                                setPriceLower(formatSmartPrice(Math.min(lower, upper)));
                                                setPriceUpper(formatSmartPrice(Math.max(lower, upper)));
                                            } else {
                                                // Deposit token1 -> Range must be BELOW current tick
                                                const upperTick = Math.floor(rawTick / tickSpacing) * tickSpacing;
                                                const lowerTick = upperTick - tickSpacing;
                                                const lower = tickToPrice(lowerTick, actualTokenA.decimals, actualTokenB.decimals, isAToken0);
                                                const upper = tickToPrice(upperTick, actualTokenA.decimals, actualTokenB.decimals, isAToken0);
                                                setPriceLower(formatSmartPrice(Math.min(lower, upper)));
                                                setPriceUpper(formatSmartPrice(Math.max(lower, upper)));
                                            }
                                        };

                                        // If invalid, show the auto-fix button instead of disabling
                                        if (invalidSingleSidedRange) {
                                            return (
                                                <motion.button
                                                    onClick={handleAutoFixRange}
                                                    className="w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:bg-orange-500/30 active:scale-[0.98]"
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <span>Auto-Fix Single-Sided Range</span>
                                                        <span className="text-xs font-normal opacity-80 mt-0.5">Shifts range to nearest valid tick</span>
                                                    </div>
                                                </motion.button>
                                            );
                                        }

                                        return (
                                            <motion.button
                                                onClick={poolType === 'cl' ? handleAddCLLiquidity : handleAddLiquidity}
                                                disabled={!canAdd || isLoading || isCLInProgress}
                                                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl ${canAdd && !isLoading && !isCLInProgress
                                                    ? 'bg-gradient-to-r from-primary via-purple-500 to-secondary text-white shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 active:scale-[0.98]'
                                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                    }`}
                                                whileTap={canAdd ? { scale: 0.98 } : {}}
                                            >
                                                {isLoading || isCLInProgress ? (
                                                    <span className="flex items-center justify-center gap-3">
                                                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Adding Liquidity...
                                                    </span>
                                                ) : !isConnected ? (
                                                    '🔗 Connect Wallet'
                                                ) : !tokenA || !tokenB ? (
                                                    'Select Tokens'
                                                ) : !amountA || (parseFloat(amountA) <= 0 && parseFloat(amountB || '0') <= 0) ? (
                                                    'Enter Amount'
                                                ) : (
                                                    <>Add Liquidity</>
                                                )}
                                            </motion.button>
                                        );
                                    })()
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Token Selector */}
            <TokenSelector
                isOpen={selectorOpen !== null}
                onClose={() => setSelectorOpen(null)}
                onSelect={(token) => {
                    if (selectorOpen === 'A') setTokenA(token);
                    else setTokenB(token);
                    setSelectorOpen(null);
                }}
                selectedToken={selectorOpen === 'A' ? tokenA : tokenB}
                excludeToken={selectorOpen === 'A' ? tokenB : tokenA}
            />
        </>
    );
}
