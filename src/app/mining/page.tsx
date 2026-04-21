'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { sei } from '@/config/chains';
import { useToast } from '@/providers/ToastProvider';
import {
    useCurrentRound,
    useCurrentRoundId,
    useMinerStats,
    useTotalClaimableBalance,
    useMinerRoundData,
    useMotherloadePots,
    useDeployToSquares,
    useFinalizeRound,
    useClaimAll,
    useClaimSei,
    useClaimLore,
    useGetRound,
    useMiningLoreBalance,
    useMinerLoreBreakdown,
} from '@/hooks/useLOREmining';

// 20,000 LORE for normal rounds, 10,000 for jackpot (contract constants)
const LORE_PER_ROUND_NORMAL = BigInt('20000000000000000000000'); // 20,000e18
const LORE_PER_ROUND_JACKPOT = BigInt('10000000000000000000000'); // 10,000e18

const MOTHERLODE_TIER_NAMES = [
    'Bronze Nugget', 'Silver Nugget', 'Gold Nugget', 'Platinum Nugget',
    'Diamond Nugget', 'Emerald Vein', 'Ruby Vein', 'Sapphire Vein',
    'Crystal Cache', 'MOTHERLODE',
];
const MOTHERLODE_TIER_COLORS = [
    'text-amber-600', 'text-gray-400', 'text-yellow-400', 'text-cyan-300',
    'text-blue-400', 'text-emerald-400', 'text-red-400', 'text-indigo-400',
    'text-purple-300', 'text-yellow-300',
];
const MOTHERLODE_TIER_BG = [
    'bg-amber-600/10', 'bg-gray-400/10', 'bg-yellow-400/10', 'bg-cyan-300/10',
    'bg-blue-400/10', 'bg-emerald-400/10', 'bg-red-400/10', 'bg-indigo-400/10',
    'bg-purple-300/10', 'bg-yellow-300/10',
];
const MOTHERLODE_ODDS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

function formatETH(wei: bigint | undefined): string {
    if (!wei) return '0';
    const n = Number(formatEther(wei));
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatLORE(wei: bigint | undefined): string {
    if (!wei) return '0';
    const n = Number(formatEther(wei));
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function useCountdown(endTimestamp: number) {
    const [remaining, setRemaining] = useState(0);
    useEffect(() => {
        const update = () => setRemaining(Math.max(0, endTimestamp - Math.floor(Date.now() / 1000)));
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [endTimestamp]);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return { remaining, display: `${mins}:${secs.toString().padStart(2, '0')}` };
}

const QUICK_AMOUNTS = ['0.0001', '0.0005', '0.001', '0.005'];

// 0-indexed square strategies for the 5×5 grid
const STRATEGIES = [
    {
        id: 'corners',
        label: 'Corners',
        desc: '4 corner squares',
        squares: [0, 4, 20, 24],
        color: 'border-rose-500/50 bg-rose-500/10 text-rose-400',
        activeColor: 'border-rose-400 bg-rose-500/25 text-rose-300',
        dot: 'bg-rose-400',
    },
    {
        id: 'cross',
        label: 'Cross',
        desc: 'Center row + column',
        squares: [2, 7, 10, 11, 12, 13, 14, 17, 22],
        color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
        activeColor: 'border-emerald-400 bg-emerald-500/25 text-emerald-300',
        dot: 'bg-emerald-400',
    },
    {
        id: 'odds',
        label: 'Odds',
        desc: 'Squares 1,3,5,7,9…',
        squares: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
        color: 'border-sky-500/50 bg-sky-500/10 text-sky-400',
        activeColor: 'border-sky-400 bg-sky-500/25 text-sky-300',
        dot: 'bg-sky-400',
    },
    {
        id: 'evens',
        label: 'Evens',
        desc: 'Squares 2,4,6,8…',
        squares: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
        color: 'border-violet-500/50 bg-violet-500/10 text-violet-400',
        activeColor: 'border-violet-400 bg-violet-500/25 text-violet-300',
        dot: 'bg-violet-400',
    },
    {
        id: 'diamond',
        label: 'Diamond',
        desc: 'Diamond pattern',
        squares: [2, 6, 8, 11, 13, 16, 18, 22],
        color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
        activeColor: 'border-yellow-400 bg-yellow-500/25 text-yellow-300',
        dot: 'bg-yellow-400',
    },
    {
        id: 'snipe',
        label: 'Snipe',
        desc: 'Single center square',
        squares: [12],
        color: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
        activeColor: 'border-orange-400 bg-orange-500/25 text-orange-300',
        dot: 'bg-orange-400',
    },
    {
        id: 'all',
        label: 'All In',
        desc: 'All 25 squares',
        squares: Array.from({ length: 25 }, (_, i) => i),
        color: 'border-pink-500/50 bg-pink-500/10 text-pink-400',
        activeColor: 'border-pink-400 bg-pink-500/25 text-pink-300',
        dot: 'bg-pink-400',
    },
] as const;

export default function MiningPage() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const isOnBase = chainId === sei.id;
    const { success, error: showError } = useToast();

    const [selectedSquares, setSelectedSquares] = useState<number[]>([]);
    const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);
    const [amountInput, setAmountInput] = useState('0.0001');
    const [activeTab, setActiveTab] = useState<'game' | 'rewards' | 'pots'>('game');

    const { data: round, refetch: refetchRound } = useCurrentRound();
    const { data: roundId, refetch: refetchRoundId } = useCurrentRoundId();
    useMinerStats(address);
    const { data: claimable, refetch: refetchClaimable } = useTotalClaimableBalance(address);
    const { data: minerRoundData, refetch: refetchMinerRound } = useMinerRoundData(roundId, address);
    const { data: pots } = useMotherloadePots();

    // Previous round for history
    const prevRoundId = roundId !== undefined && roundId > BigInt(0) ? roundId - BigInt(1) : undefined;
    const { data: prevRound } = useGetRound(prevRoundId);

    // LORE balance of mining contract → estimated reward
    const { data: miningLoreBalance } = useMiningLoreBalance();
    const { data: loreBreakdown } = useMinerLoreBreakdown(address);

    const { deploy, isPending: isDeploying, isSuccess: deploySuccess } = useDeployToSquares();
    const { finalize, isPending: isFinalizing, isSuccess: finalizeSuccess } = useFinalizeRound();
    const { claim, isPending: isClaiming, isSuccess: claimSuccess } = useClaimAll();
    const { claim: claimSei, isPending: isClaimingSei, isSuccess: claimSeiSuccess } = useClaimSei();
    const { claim: claimLore, isPending: isClaimingLore, isSuccess: claimLoreSuccess } = useClaimLore();

    const endTime = round ? Number(round.endTime) : 0;
    const { display: countdown, remaining: timeLeft } = useCountdown(endTime);

    const canFinalize = round && timeLeft === 0 && !round.finalized;

    useEffect(() => {
        if (deploySuccess || finalizeSuccess || claimSuccess || claimSeiSuccess || claimLoreSuccess) {
            refetchRoundId();
            refetchRound();
            refetchClaimable();
            refetchMinerRound();
            setSelectedSquares([]);
            setActiveStrategyId(null);
        }
    }, [deploySuccess, finalizeSuccess, claimSuccess, claimSeiSuccess, claimLoreSuccess]);

    const toggleSquare = (i: number) => {
        setActiveStrategyId(null);
        setSelectedSquares(prev =>
            prev.includes(i) ? prev.filter(s => s !== i) : [...prev, i]
        );
    };

    const applyStrategy = (strategyId: string, squares: readonly number[]) => {
        if (activeStrategyId === strategyId) {
            setActiveStrategyId(null);
            setSelectedSquares([]);
        } else {
            setActiveStrategyId(strategyId);
            const available = canFinalize
                ? [...squares]
                : (squares as number[]).filter(s => mySquareDeployment(s) === BigInt(0));
            setSelectedSquares(available);
        }
    };

    const handleDeploy = async () => {
        if (!isConnected || !isOnBase || selectedSquares.length === 0) return;
        try {
            await deploy(selectedSquares, parseEther(amountInput || '0.001'));
            success(`Deployed to ${selectedSquares.length} square${selectedSquares.length > 1 ? 's' : ''}!`);
        } catch (err: unknown) {
            showError((err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : undefined) || 'Deploy failed');
        }
    };

    const handleFinalize = async () => {
        try {
            await finalize();
            success('Round finalized!');
        } catch (err: unknown) {
            showError((err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : undefined) || 'Finalize failed');
        }
    };

    const handleClaimAll = async () => {
        try {
            await claim();
            success('Rewards claimed!');
        } catch (err: unknown) {
            showError((err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : undefined) || 'Claim failed');
        }
    };

    const handleClaimEth = async () => {
        try {
            await claimSei();
            success('ETH claimed!');
        } catch (err: unknown) {
            showError((err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : undefined) || 'Claim failed');
        }
    };

    const handleClaimLore = async () => {
        try {
            await claimLore();
            success('LORE claimed!');
        } catch (err: unknown) {
            showError((err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : undefined) || 'Claim failed');
        }
    };

    const getSquareAmount = (i: number) => round?.deployed[i] ?? BigInt(0);
    const getSquareMinerCount = (i: number) => round?.minerCount[i] ?? BigInt(0);
    const mySquareDeployment = (i: number) => minerRoundData?.deployed[i] ?? BigInt(0);
    const isWinningSquare = (i: number) => round?.finalized === true && round.winningSquare === i;

    const totalDeployed = round?.totalDeployed ?? BigInt(0);
    const isJackpot = round?.isJackpotRound ?? false;

    const loreRewardEstimate = (() => {
        if (round?.finalized) return round.loreReward;
        const target = isJackpot ? LORE_PER_ROUND_JACKPOT : LORE_PER_ROUND_NORMAL;
        if (miningLoreBalance === undefined) return undefined;
        return miningLoreBalance >= target ? target : miningLoreBalance;
    })();
    const totalClaimableEth = claimable ? claimable[0] : BigInt(0);
    const totalClaimableLore = claimable ? claimable[1] : BigInt(0);
    const hasClaimable = totalClaimableEth > BigInt(0) || totalClaimableLore > BigInt(0);

    const amountPerSquare = parseEther(amountInput || '0');
    const totalCost = amountPerSquare * BigInt(selectedSquares.length);

    const urgent = timeLeft > 0 && timeLeft <= 10 && round?.timerStarted;

    return (
        <div className="min-h-screen pb-52 md:pb-40">
            <div className="container mx-auto px-3 sm:px-4 py-4 max-w-2xl">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold gradient-text">LORE Mining</h1>
                            {isJackpot && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 animate-pulse">
                                    JACKPOT
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-foreground/50 mt-0.5">Deploy ETH · Win the pot · Earn LORE</p>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-foreground/40 uppercase tracking-wide">Round</div>
                        <div className="text-lg font-bold">#{roundId?.toString() ?? '—'}</div>
                    </div>
                </div>

                {/* Chain Warning */}
                {isConnected && !isOnBase && (
                    <div className="mb-3 p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-center justify-between">
                        <span className="text-sm text-yellow-400">Switch to Base to play</span>
                        <button onClick={() => switchChain({ chainId: sei.id })} className="btn-primary text-xs py-1.5 px-3">
                            Switch
                        </button>
                    </div>
                )}

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="card text-center py-2.5 px-2">
                        <div className="text-[10px] text-foreground/40 uppercase tracking-wide mb-0.5">
                            {round?.timerStarted ? 'Time Left' : 'Waiting'}
                        </div>
                        <div className={`text-base sm:text-lg font-bold font-mono tabular-nums ${urgent ? 'text-red-400 animate-pulse' : 'text-primary'}`}>
                            {round?.timerStarted ? countdown : '--:--'}
                        </div>
                    </div>
                    <div className="card text-center py-2.5 px-2">
                        <div className="text-[10px] text-foreground/40 uppercase tracking-wide mb-0.5">Total Pot</div>
                        <div className="text-base sm:text-lg font-bold">{formatETH(totalDeployed)}<span className="text-xs font-normal text-foreground/50 ml-0.5">ETH</span></div>
                    </div>
                    <div className="card text-center py-2.5 px-2">
                        <div className="text-[10px] text-foreground/40 uppercase tracking-wide mb-0.5">LORE Prize</div>
                        <div className="text-base sm:text-lg font-bold text-yellow-400">
                            {loreRewardEstimate === undefined ? '…' : formatLORE(loreRewardEstimate)}
                        </div>
                        {!round?.finalized && loreRewardEstimate !== undefined && (
                            <div className="text-[9px] text-foreground/30">est.</div>
                        )}
                    </div>
                </div>

                {/* Finalize Banner */}
                {canFinalize && (
                    <div className="mb-4 p-3 rounded-xl border border-primary/40 bg-primary/10 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-primary">Round Expired!</div>
                                <div className="text-xs text-foreground/60">Auto-finalizes when next round starts, or finalize now</div>
                            </div>
                            <button
                                onClick={handleFinalize}
                                disabled={isFinalizing}
                                className="btn-primary text-sm py-2 px-4 shrink-0"
                            >
                                {isFinalizing ? 'Finalizing…' : 'Finalize'}
                            </button>
                    </div>
                )}

                {/* Motherlode Pots Strip */}
                {pots && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] text-foreground/40 uppercase tracking-wide font-medium">Motherlode Pots — win big this round</span>
                            <span className="text-[10px] text-yellow-400 animate-pulse">✦</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none -mx-1 px-1">
                            {MOTHERLODE_TIER_NAMES.map((name, i) => {
                                const pot = pots[i] ?? BigInt(0);
                                const isLast = i === MOTHERLODE_TIER_NAMES.length - 1;
                                return (
                                    <div
                                        key={i}
                                        className={`snap-start shrink-0 rounded-xl border px-3 py-2.5 min-w-[110px] text-center
                                            ${isLast
                                                ? 'border-yellow-300/40 bg-yellow-300/10 shadow-md shadow-yellow-400/10'
                                                : `border-white/8 ${MOTHERLODE_TIER_BG[i]}`
                                            }`}
                                    >
                                        <div className={`text-[10px] font-semibold truncate ${MOTHERLODE_TIER_COLORS[i]}`}>{name}</div>
                                        <div className={`text-base font-bold mt-0.5 ${MOTHERLODE_TIER_COLORS[i]}`}>
                                            {formatLORE(pot)}
                                        </div>
                                        <div className="text-[9px] text-foreground/30 mt-0.5">LORE · 1/{MOTHERLODE_ODDS[i]}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Last Round Result */}
                {prevRound?.finalized && prevRoundId !== undefined && (
                    <div className="mb-4 px-3 py-2.5 rounded-xl border border-yellow-400/20 bg-yellow-400/5">
                        <div className="flex items-center gap-3">
                            <span className="text-lg shrink-0">🏆</span>
                            <div className="min-w-0">
                                <div className="text-[10px] text-foreground/40 uppercase tracking-wide">Last Round #{prevRoundId.toString()}</div>
                                <div className="text-sm font-semibold">
                                    Square <span className="text-yellow-400">{Number(prevRound.winningSquare) + 1}</span> won{' '}
                                    <span className="text-foreground/70">{formatETH(prevRound.totalDeployed)} ETH</span>
                                    {prevRound.loreReward > BigInt(0) && (
                                        <span className="text-yellow-400"> + {formatLORE(prevRound.loreReward)} LORE</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        {prevRound.totalMotherlodeReward > BigInt(0) && (
                            <div className="mt-2 pt-2 border-t border-yellow-400/10 space-y-0.5">
                                {MOTHERLODE_TIER_NAMES.map((name, i) =>
                                    (Number(prevRound.motherlodeTiersHit) & (1 << i)) !== 0 ? (
                                        <div key={i} className={`text-xs font-medium ${MOTHERLODE_TIER_COLORS[i]}`}>
                                            {name} hit — +{formatLORE(prevRound.totalMotherlodeReward)} LORE
                                        </div>
                                    ) : null
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-surface/40 rounded-xl p-1">
                    {(['game', 'rewards', 'pots'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize relative ${activeTab === tab
                                ? 'bg-primary/20 text-primary'
                                : 'text-foreground/50 hover:text-foreground'
                                }`}
                        >
                            {tab === 'rewards' ? 'Rewards' : tab === 'pots' ? 'Pots' : 'Play'}
                            {tab === 'rewards' && hasClaimable && (
                                <span className="absolute top-1.5 right-2 w-1.5 h-1.5 bg-green-400 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* ── GAME TAB ── */}
                {activeTab === 'game' && (
                    <div className="space-y-3">

                        {/* Strategy Presets */}
                        {!round?.finalized && (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] text-foreground/40 uppercase tracking-wide font-medium">Quick Strategies</span>
                                    {activeStrategyId && (
                                        <button
                                            onClick={() => { setActiveStrategyId(null); setSelectedSquares([]); }}
                                            className="text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors ml-auto"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1 snap-x scrollbar-none -mx-1 px-1">
                                    {STRATEGIES.map(s => {
                                        const isActive = activeStrategyId === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => applyStrategy(s.id, s.squares)}
                                                className={`snap-start shrink-0 flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all active:scale-95 ${isActive ? s.activeColor : s.color}`}
                                            >
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                                                    <span className="text-xs font-semibold whitespace-nowrap">{s.label}</span>
                                                </div>
                                                <span className="text-[10px] opacity-60 whitespace-nowrap">{s.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Grid */}
                        <div className="card">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium">5×5 Grid</span>
                                {selectedSquares.length > 0 && (
                                    <button
                                        onClick={() => { setSelectedSquares([]); setActiveStrategyId(null); }}
                                        className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
                                    >
                                        Clear ({selectedSquares.length})
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                                {Array.from({ length: 25 }, (_, i) => {
                                    const squareAmount = getSquareAmount(i);
                                    const minerCount = getSquareMinerCount(i);
                                    const myAmount = mySquareDeployment(i);
                                    const isSelected = selectedSquares.includes(i);
                                    const isWinner = isWinningSquare(i);
                                    const hasMyDeployment = myAmount > BigInt(0) && !canFinalize;
                                    const pct = totalDeployed > BigInt(0)
                                        ? Number((squareAmount * BigInt(100)) / totalDeployed)
                                        : 0;

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => toggleSquare(i)}
                                            disabled={hasMyDeployment || !!round?.finalized}
                                            className={`
                                                relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center
                                                font-medium transition-colors overflow-hidden select-none
                                                active:opacity-80 disabled:cursor-default
                                                ${isWinner
                                                    ? 'border-yellow-400 bg-yellow-400/25 text-yellow-300'
                                                    : isSelected
                                                        ? 'border-blue-400 bg-blue-500/40 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400/50'
                                                        : hasMyDeployment
                                                            ? 'border-green-500 bg-green-500/15 text-green-400'
                                                            : squareAmount > BigInt(0)
                                                                ? 'border-foreground/20 bg-surface/60 text-foreground/70 hover:border-foreground/40'
                                                                : 'border-foreground/10 bg-surface/20 text-foreground/30 hover:border-primary/50 hover:bg-primary/5'
                                                }
                                            `}
                                        >
                                            {/* Heat fill */}
                                            {pct > 0 && !isSelected && !isWinner && (
                                                <div
                                                    className="absolute bottom-0 left-0 right-0 bg-primary/15 transition-all"
                                                    style={{ height: `${Math.min(pct, 100)}%` }}
                                                />
                                            )}

                                            <span className="relative z-10 text-xs sm:text-sm font-bold leading-none">{i + 1}</span>

                                            {squareAmount > BigInt(0) && (
                                                <span className="relative z-10 text-[9px] sm:text-[10px] leading-tight opacity-70 mt-0.5">
                                                    {formatETH(squareAmount)}
                                                </span>
                                            )}

                                            {minerCount > BigInt(0) && (
                                                <span className="relative z-10 text-[8px] opacity-40 leading-none">
                                                    {minerCount.toString()}p
                                                </span>
                                            )}

                                            {isSelected && (
                                                <span className="absolute top-0.5 right-1 text-[11px] text-blue-200 font-bold">✓</span>
                                            )}

                                            {isWinner && (
                                                <span className="absolute top-0.5 right-1 text-[10px]">★</span>
                                            )}

                                            {hasMyDeployment && !isWinner && (
                                                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-400 rounded-full" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-foreground/40">
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded border-2 border-blue-400 bg-blue-500/40 shrink-0 inline-block" />
                                    Selected
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded border-2 border-green-500 shrink-0 inline-block" />
                                    My deploy
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded border-2 border-yellow-400 shrink-0 inline-block" />
                                    Winner
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded border-2 border-foreground/20 bg-primary/10 shrink-0 inline-block" />
                                    Heat = pot share
                                </span>
                            </div>
                        </div>

                        {/* Finalized Result */}
                        {round?.finalized && (
                            <div className="card border border-yellow-400/30 bg-yellow-400/5 text-center space-y-1.5 py-5">
                                <div className="text-3xl">🏆</div>
                                <div className="text-yellow-400 font-semibold text-sm">Round Finalized</div>
                                <div className="text-2xl font-bold">Square {Number(round.winningSquare) + 1} wins!</div>
                                <div className="text-sm text-foreground/60">
                                    {formatETH(round.totalDeployed)} ETH{round.loreReward > BigInt(0) ? ` + ${formatLORE(round.loreReward)} LORE` : ''} split among winners
                                </div>
                                {round.totalMotherlodeReward > BigInt(0) && (
                                    <div className="text-sm text-yellow-400 font-medium">
                                        ✨ +{formatLORE(round.totalMotherlodeReward)} LORE Motherlode bonus!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── REWARDS TAB ── */}
                {activeTab === 'rewards' && (
                    <div className="space-y-3">
                        <div className="card space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl bg-surface/50 p-3 text-center">
                                    <div className="text-[10px] text-foreground/40 uppercase tracking-wide mb-1">Claimable ETH</div>
                                    <div className="text-xl font-bold">{formatETH(totalClaimableEth)}</div>
                                    <div className="text-[10px] text-foreground/40 mt-0.5">ETH</div>
                                </div>
                                <div className="rounded-xl bg-surface/50 p-3 text-center">
                                    <div className="text-[10px] text-foreground/40 uppercase tracking-wide mb-1">Claimable LORE</div>
                                    <div className="text-xl font-bold text-yellow-400">{formatLORE(totalClaimableLore)}</div>
                                    <div className="text-[10px] text-foreground/40 mt-0.5">LORE</div>
                                </div>
                                <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3 text-center">
                                    <div className="text-[10px] text-purple-300/60 uppercase tracking-wide mb-1">Refined LORE</div>
                                    <div className="text-xl font-bold text-purple-300">{loreBreakdown ? formatLORE(loreBreakdown[1] + loreBreakdown[2]) : '0'}</div>
                                    <div className="text-[10px] text-purple-300/40 mt-0.5">from fees ✦</div>
                                </div>
                            </div>

                            {loreBreakdown && (loreBreakdown[0] > BigInt(0) || loreBreakdown[1] > BigInt(0) || loreBreakdown[2] > BigInt(0)) && (
                                <div className="rounded-xl bg-surface/30 p-3 space-y-2">
                                    <div className="text-xs font-medium text-foreground/60 mb-1">LORE Breakdown</div>
                                    {[
                                        ['Unclaimed LORE', `${formatLORE(loreBreakdown[0])} LORE`],
                                        ['Refined (earned)', `${formatLORE(loreBreakdown[1])} LORE`],
                                        ['Refining (pending)', `${formatLORE(loreBreakdown[2])} LORE`],
                                        ['Total Claimable', `${formatLORE(loreBreakdown[3])} LORE`],
                                    ].map(([label, val]) => (
                                        <div key={label} className="flex justify-between text-xs">
                                            <span className="text-foreground/50">{label}</span>
                                            <span className="font-medium">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!isConnected ? (
                                <p className="text-sm text-foreground/50 text-center py-2">Connect wallet to view rewards</p>
                            ) : !isOnBase ? (
                                <button onClick={() => switchChain({ chainId: sei.id })} className="btn-primary w-full py-3.5">
                                    Switch to Base
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        onClick={handleClaimAll}
                                        disabled={isClaiming || isClaimingSei || isClaimingLore || !hasClaimable}
                                        className="btn-primary w-full py-3.5 text-base disabled:opacity-50"
                                    >
                                        {isClaiming ? 'Claiming…' : hasClaimable ? '⬇ Claim All Rewards' : 'No rewards yet'}
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleClaimEth}
                                            disabled={isClaiming || isClaimingSei || isClaimingLore || totalClaimableEth === BigInt(0)}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-surface/50 hover:bg-surface/80 transition-all disabled:opacity-40"
                                        >
                                            {isClaimingSei ? 'Claiming…' : `Claim ETH`}
                                        </button>
                                        <button
                                            onClick={handleClaimLore}
                                            disabled={isClaiming || isClaimingSei || isClaimingLore || totalClaimableLore === BigInt(0)}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-yellow-400/20 bg-yellow-400/5 hover:bg-yellow-400/10 text-yellow-400 transition-all disabled:opacity-40"
                                        >
                                            {isClaimingLore ? 'Claiming…' : `Claim LORE`}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="card text-xs text-foreground/50 space-y-2">
                            <div className="font-medium text-foreground/70">How rewards work</div>
                            {[
                                'Winners get their ETH back + proportional share of losing squares',
                                'All players on winning square split the LORE reward proportionally',
                                'Claiming LORE has a 10% fee — but that fee is redistributed to all unclaimed LORE holders',
                                'Don\'t claim yet? You earn 10% of every other player\'s LORE claim as "Refined LORE"',
                                'The longer you hold unclaimed LORE, the more Refined LORE you accumulate',
                                'Rewards accumulate automatically across rounds',
                            ].map(t => (
                                <div key={t} className="flex gap-2">
                                    <span className="text-primary shrink-0">·</span>
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── POTS TAB ── */}
                {activeTab === 'pots' && (
                    <div className="space-y-3">
                        <div className="card">
                            <div className="text-sm font-medium mb-1">Motherlode Pots</div>
                            <p className="text-xs text-foreground/50 mb-4">
                                Every round, all pots grow. Winners randomly hit a tier and claim it. Higher tiers are rarer but worth more LORE.
                            </p>
                            <div className="space-y-1.5">
                                {MOTHERLODE_TIER_NAMES.map((name, i) => {
                                    const pot = pots ? pots[i] : BigInt(0);
                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${MOTHERLODE_TIER_BG[i]}`}
                                        >
                                            <div>
                                                <div className={`text-sm font-semibold ${MOTHERLODE_TIER_COLORS[i]}`}>{name}</div>
                                                <div className="text-[10px] text-foreground/40">1 in {MOTHERLODE_ODDS[i]}</div>
                                            </div>
                                            <div className={`text-sm font-bold ${MOTHERLODE_TIER_COLORS[i]}`}>
                                                {formatLORE(pot)} LORE
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 text-[10px] text-foreground/20 text-center">
                    Base Mainnet
                </div>
            </div>

            {/* ── STICKY DEPLOY PANEL (bottom) ── */}
            {activeTab === 'game' && !round?.finalized && (
                <div className="fixed left-0 right-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-white/10 px-3 pt-3 pb-3 md:bottom-0" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
                    <div className="max-w-2xl mx-auto space-y-2.5">
                        {/* Quick amounts */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground/50 shrink-0">ETH per square</span>
                            <div className="flex gap-1.5 flex-1">
                                {QUICK_AMOUNTS.map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmountInput(amt)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${amountInput === amt
                                            ? 'border-primary bg-primary/20 text-primary'
                                            : 'border-white/10 bg-surface/50 text-foreground/60 hover:border-foreground/30'
                                            }`}
                                    >
                                        {amt}
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    value={amountInput}
                                    onChange={e => setAmountInput(e.target.value)}
                                    min="0.0001"
                                    step="0.001"
                                    className="input w-16 text-center text-xs py-1.5"
                                    placeholder="amt"
                                />
                            </div>
                        </div>

                        {/* Selection summary + deploy button */}
                        <div className="flex items-center gap-2">
                            {selectedSquares.length > 0 ? (
                                <div className="text-xs text-foreground/60 shrink-0">
                                    <span className="font-bold text-foreground">{selectedSquares.length}</span> sq ·{' '}
                                    <span className="font-bold text-foreground">{formatETH(totalCost)} ETH</span> total
                                </div>
                            ) : (
                                <div className="text-xs text-foreground/40 shrink-0">Tap squares above</div>
                            )}
                            <div className="flex-1" />
                            {!isConnected ? (
                                <button disabled className="btn-primary px-5 py-3 text-sm opacity-50">Connect Wallet</button>
                            ) : !isOnBase ? (
                                <button onClick={() => switchChain({ chainId: sei.id })} className="btn-primary px-5 py-3 text-sm">
                                    Switch to Base
                                </button>
                            ) : (
                                <button
                                    onClick={handleDeploy}
                                    disabled={isDeploying || selectedSquares.length === 0 || !amountInput || parseFloat(amountInput) <= 0}
                                    className="btn-primary px-5 py-3 text-sm font-semibold disabled:opacity-50 min-w-[120px]"
                                >
                                    {isDeploying
                                        ? 'Deploying…'
                                        : selectedSquares.length === 0
                                            ? 'Select Squares'
                                            : `Deploy ${formatETH(totalCost)} ETH`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
