'use client';

import { useState, useEffect } from 'react';

import { useAccount, usePublicClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { sei } from '@/config/chains';
import { useToast } from '@/providers/ToastProvider';
import {
    useWindMarketInfo,
    useWindBuyInfo,
    useWindMaxBuyForBudget,
    useWindSellInfo,
    useWindReserveHealth,
    useWindUserInfo,
    useWindcBalance,
    useBTBBalance,
    useBTBAllowanceForCurve,
    useWindcAllowanceForStaking,
    useApproveBTBForCurve,
    useApproveWindcForStaking,
    useWindBuy,
    useWindSell,
    useStakingGlobalInfo,
    useStakingAPR,
    useStakingUserInfo,
    useStake,
    useUnstake,
    useClaimRewards,
    useEmergencyUnstake,
    useEmergencyUnstakeEnabled,
} from '@/hooks/useWindCurve';
// ── helpers ────────────────────────────────────────────────────────────────

function fmt(wei: bigint | undefined, dp = 4): string {
    if (!wei) return '0';
    const n = Number(formatEther(wei));
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: dp });
    return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

function fmtBps(bps: bigint | undefined): string {
    if (!bps) return '0';
    return (Number(bps) / 100).toFixed(2);
}

function fmtLockEnd(lockEnd: bigint): string {
    if (lockEnd === 0n) return '';
    const now = Math.floor(Date.now() / 1000);
    const end = Number(lockEnd);
    if (now >= end) return '';
    const secs = end - now;
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h remaining`;
    const mins = Math.floor((secs % 3600) / 60);
    return `${hours}h ${mins}m remaining`;
}

// ── tab types ──────────────────────────────────────────────────────────────

type Tab = 'buy' | 'sell' | 'stake';

// ── main page ──────────────────────────────────────────────────────────────

export default function WindPage() {
    const { address } = useAccount();
    const toast = useToast();
    const publicClient = usePublicClient({ chainId: sei.id });
    const [tab, setTab] = useState<Tab>('buy');

    // ── market data ──
    const { data: marketInfo } = useWindMarketInfo();
    const { data: reserveHealth } = useWindReserveHealth();
    const { data: stakingGlobal } = useStakingGlobalInfo();
    const { data: apr } = useStakingAPR();

    // ── user data ──
    const { data: userCurveInfo, refetch: refetchUserCurve } = useWindUserInfo(address);
    const { data: windcBal, refetch: refetchWindc } = useWindcBalance(address);
    const { data: btbBal, refetch: refetchBTB } = useBTBBalance(address);
    const { data: btbAllowance, refetch: refetchBtbAllow } = useBTBAllowanceForCurve(address);
    const { data: windcAllowance, refetch: refetchWindcAllow } = useWindcAllowanceForStaking(address);
    const { data: stakingUser, refetch: refetchStakingUser } = useStakingUserInfo(address);

    // ── buy tab state ──
    // User inputs WIND to spend → contract tells us max WINDC mintable
    const [buyWindAmount, setBuyWindAmount] = useState('');
    const buyWindWei = buyWindAmount && Number(buyWindAmount) > 0
        ? parseEther(buyWindAmount) : undefined;
    const { data: maxBuyData } = useWindMaxBuyForBudget(buyWindWei);
    const maxBuyResult = maxBuyData as unknown as [bigint, bigint, bigint, bigint] | undefined;
    const { approve: approveBTB, isPending: approvingBTB } = useApproveBTBForCurve();
    const { buy, isPending: buying } = useWindBuy();

    // ── sell tab state ──
    // sell(totalAmount) takes ERC20 wei (user's balance). Use parseEther.
    const [sellAmount, setSellAmount] = useState('');
    const sellAmount_ = sellAmount && Number(sellAmount) > 0
        ? parseEther(sellAmount) : undefined;
    const { data: sellInfo } = useWindSellInfo(sellAmount_);
    const { sell, isPending: selling } = useWindSell();

    // ── stake tab state ──
    const [stakeAmount, setStakeAmount] = useState('');
    const [unstakeAmount, setUnstakeAmount] = useState('');
    const stakeAmountWei = stakeAmount ? parseEther(stakeAmount) : undefined;
    const unstakeAmountWei = unstakeAmount ? parseEther(unstakeAmount) : undefined;
    const { approve: approveWindc, isPending: approvingWindc } = useApproveWindcForStaking();
    const { stake, isPending: staking } = useStake();
    const { unstake, isPending: unstaking } = useUnstake();
    const { claim, isPending: claiming } = useClaimRewards();
    const { emergencyUnstake, isPending: emergencyUnstaking } = useEmergencyUnstake();
    const { data: emergencyEnabled } = useEmergencyUnstakeEnabled();

    const refetchAll = () => {
        refetchUserCurve(); refetchWindc(); refetchBTB();
        refetchBtbAllow(); refetchWindcAllow(); refetchStakingUser();
    };

    // ── buy handler ──
    const handleBuy = async () => {
        if (!maxBuyResult || maxBuyResult[0] === 0n) return;
        const tokensToMint = maxBuyResult[0]; // whole token count for buy()
        const cost = maxBuyResult[1];          // exact WIND cost
        try {
            if (!btbAllowance || btbAllowance < cost) {
                toast.info('Approving WIND token...');
                const approveTx = await approveBTB(cost);
                await publicClient!.waitForTransactionReceipt({ hash: approveTx });
                await refetchBtbAllow();
                toast.success('Approved!');
            }
            toast.info('Buying WINDC...');
            await buy(tokensToMint);
            toast.success(`Bought ${fmt(maxBuyResult[2])} WINDC!`);
            setBuyWindAmount('');
            setTimeout(refetchAll, 2000);
        } catch (e: unknown) {
            toast.error((e as Error)?.message?.slice(0, 80) || 'Transaction failed');
        }
    };

    // ── sell handler ──
    const handleSell = async () => {
        if (!sellAmount_) return;
        try {
            toast.info('Selling WINDC...');
            await sell(sellAmount_);
            toast.success('Sold successfully!');
            setSellAmount('');
            setTimeout(refetchAll, 2000);
        } catch (e: unknown) {
            toast.error((e as Error)?.message?.slice(0, 80) || 'Transaction failed');
        }
    };

    // ── stake handler ──
    const handleStake = async () => {
        if (!stakeAmountWei) return;
        try {
            if (!windcAllowance || windcAllowance < stakeAmountWei) {
                toast.info('Approving WINDC for staking...');
                const approveTx = await approveWindc(stakeAmountWei * 2n);
                await publicClient!.waitForTransactionReceipt({ hash: approveTx });
                await refetchWindcAllow();
                toast.success('Approved!');
            }
            toast.info('Staking WINDC...');
            await stake(stakeAmountWei);
            toast.success('Staked successfully!');
            setStakeAmount('');
            setTimeout(refetchAll, 2000);
        } catch (e: unknown) {
            toast.error((e as Error)?.message?.slice(0, 80) || 'Transaction failed');
        }
    };

    const handleUnstake = async () => {
        if (!unstakeAmountWei) return;
        try {
            toast.info('Unstaking WINDC...');
            await unstake(unstakeAmountWei);
            toast.success('Unstaked + rewards claimed!');
            setUnstakeAmount('');
            setTimeout(refetchAll, 2000);
        } catch (e: unknown) {
            toast.error((e as Error)?.message?.slice(0, 80) || 'Transaction failed');
        }
    };

    const handleClaim = async () => {
        try {
            toast.info('Claiming rewards...');
            await claim();
            toast.success('Rewards claimed!');
            setTimeout(refetchAll, 2000);
        } catch (e: unknown) {
            toast.error((e as Error)?.message?.slice(0, 80) || 'Transaction failed');
        }
    };

    const handleEmergencyUnstake = async () => {
        try {
            toast.info('Emergency unstaking (forfeiting rewards)...');
            await emergencyUnstake();
            toast.success('Emergency unstake complete.');
            setTimeout(refetchAll, 2000);
        } catch (e: unknown) {
            toast.error((e as Error)?.message?.slice(0, 80) || 'Transaction failed');
        }
    };

    const [currentPrice, supply, reserve, lockedBalance, circulatingSupply] =
        (marketInfo as [bigint, bigint, bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n, 0n, 0n];
    const [healthReserve, healthCirc, healthLocked, healthTotal, reserveRatio] =
        (reserveHealth as [bigint, bigint, bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n, 0n, 0n];
    const [totalStaked, rewardRate, periodFinish, , rewardPool] =
        (stakingGlobal as [bigint, bigint, bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n, 0n, 0n];
    const [stakedAmt, earnedRewards, lockEnd] =
        (stakingUser as [bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n];
    const [userBalance, wouldBurn, wouldLock, wouldReceiveBtb] =
        (userCurveInfo as [bigint, bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n, 0n];

    const aprPct = apr ? Number(apr) / 100 : 0;
    const solvent = reserveRatio ? Number(reserveRatio) >= 10000 : false;

    return (
        <div className="min-h-screen pt-24 pb-32 px-4">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header */}
                <div

                    className="text-center"
                >
                    <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">WIND Curve</h1>
                    <p className="text-gray-400 text-sm">Linear bonding curve — buy & sell WINDC, stake to earn</p>
                </div>

                {/* Market Stats */}
                <div


                    className="glass-card p-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                >
                    <div className="text-center">
                        <p className="text-gray-400 text-xs mb-1">Staking APR</p>
                        <p className="font-bold text-green-400">{aprPct > 0 ? aprPct.toFixed(2) + '%' : '—'}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-xs mb-1">Current Price</p>
                        <p className="font-bold text-primary">{fmt(currentPrice)} WIND</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-xs mb-1">Circulating</p>
                        <p className="font-bold">{fmt(circulatingSupply)} WINDC</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-xs mb-1">Reserve</p>
                        <p className="font-bold">{fmt(reserve)} WIND</p>
                    </div>
                </div>

                {/* User balances */}
                {address && (
                    <div


                        className="glass-card p-4 grid grid-cols-3 gap-3 text-center text-sm"
                    >
                        <div>
                            <p className="text-gray-400 text-xs mb-1">WIND Balance</p>
                            <p className="font-semibold">{fmt(btbBal)}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs mb-1">WINDC Balance</p>
                            <p className="font-semibold">{fmt(windcBal)}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs mb-1">Staked WINDC</p>
                            <p className="font-semibold">{fmt(stakedAmt)}</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2">
                    {(['buy', 'sell', 'stake'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-2.5 rounded-xl font-semibold capitalize transition-all text-sm ${tab === t
                                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                                : 'glass-card text-gray-400 hover:text-white'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                

                    {/* ── BUY ── */}
                    {tab === 'buy' && (
                        <div
                            key="buy"


                            className="glass-card p-5 space-y-4"
                        >
                            <h2 className="font-bold text-lg">Buy WINDC</h2>
                            <p className="text-gray-400 text-xs">Enter how much WIND you want to spend — we'll show you exactly how many WINDC you'll receive.</p>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 flex items-center justify-between">
                                    <span>WIND to spend</span>
                                    {btbBal && btbBal > 0n && (
                                        <button onClick={() => setBuyWindAmount(formatEther(btbBal))}
                                            className="text-primary hover:underline">
                                            Max ({fmt(btbBal)} WIND)
                                        </button>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0.0"
                                    value={buyWindAmount}
                                    onChange={(e) => setBuyWindAmount(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                                />
                                <div className="flex gap-2 mt-2">
                                    {['100', '500', '1000', '5000'].map((v) => (
                                        <button key={v} onClick={() => setBuyWindAmount(v)}
                                            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-primary/20 text-gray-400 hover:text-primary transition-all">
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {maxBuyResult && maxBuyResult[0] > 0n && (
                                <div className="bg-white/5 rounded-xl p-3 space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">You receive</span>
                                        <span className="font-semibold text-green-400">{maxBuyResult[2].toString()} WINDC</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">To stakers (40%)</span>
                                        <span className="text-gray-500">{maxBuyResult[3].toString()} WINDC</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Actual WIND cost</span>
                                        <span className="text-gray-400">{fmt(maxBuyResult[1])} WIND</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleBuy}
                                disabled={!address || !maxBuyResult || maxBuyResult[0] === 0n || buying || approvingBTB}
                                className="w-full py-3 rounded-xl font-bold btn-gradient disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {!address ? 'Connect Wallet' : approvingBTB ? 'Approving...' : buying ? 'Buying...' : 'Buy WINDC'}
                            </button>
                        </div>
                    )}

                    {/* ── SELL ── */}
                    {tab === 'sell' && (
                        <div
                            key="sell"


                            className="glass-card p-5 space-y-4"
                        >
                            <h2 className="font-bold text-lg">Sell WINDC</h2>
                            <p className="text-gray-400 text-xs">Sell WINDC → receive WIND. 60% of your tokens are burned (reducing supply), 40% go to stakers as rewards.</p>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">
                                    WINDC to sell
                                    {windcBal && windcBal > 0n && (
                                        <button onClick={() => setSellAmount(formatEther(windcBal))}
                                            className="ml-2 text-primary hover:underline">Max ({fmt(windcBal)})</button>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0.0"
                                    value={sellAmount}
                                    onChange={(e) => setSellAmount(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>

                            {sellInfo && sellAmount_ && sellAmount_ > 0n && (
                                <div className="bg-white/5 rounded-xl p-3 space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">WIND received</span>
                                        <span className="font-semibold text-green-400">{fmt((sellInfo as [bigint, bigint, bigint])[0])} WIND</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Tokens burned (60%)</span>
                                        <span className="text-gray-500">{((sellInfo as [bigint, bigint, bigint])[1]).toString()} WINDC</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">To stakers (40%)</span>
                                        <span className="text-gray-500">{((sellInfo as [bigint, bigint, bigint])[2]).toString()} WINDC</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleSell}
                                disabled={!address || !sellAmount_ || selling}
                                className="w-full py-3 rounded-xl font-bold btn-gradient disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {!address ? 'Connect Wallet' : selling ? 'Selling...' : 'Sell WINDC'}
                            </button>
                        </div>
                    )}

                    {/* ── STAKE ── */}
                    {tab === 'stake' && (
                        <div
                            key="stake"


                            className="space-y-4"
                        >
                            {/* Staking stats */}
                            <div className="glass-card p-4 grid grid-cols-3 gap-3 text-center text-sm">
                                <div>
                                    <p className="text-gray-400 text-xs mb-1">APR</p>
                                    <p className="font-bold text-green-400">{aprPct > 0 ? aprPct.toFixed(2) + '%' : '—'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs mb-1">Total Staked</p>
                                    <p className="font-bold">{fmt(totalStaked)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs mb-1">Reward Pool</p>
                                    <p className="font-bold">{fmt(rewardPool)}</p>
                                </div>
                            </div>

                            {/* User rewards */}
                            {address && earnedRewards > 0n && (
                                <div className="glass-card p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">Pending Rewards</p>
                                        <p className="font-bold text-green-400">{fmt(earnedRewards)} WINDC</p>
                                    </div>
                                    <button
                                        onClick={handleClaim}
                                        disabled={claiming}
                                        className="px-4 py-2 rounded-xl btn-gradient font-semibold text-sm disabled:opacity-40"
                                    >
                                        {claiming ? 'Claiming...' : 'Claim'}
                                    </button>
                                </div>
                            )}

                            {/* Stake */}
                            <div className="glass-card p-5 space-y-3">
                                <h3 className="font-bold">Stake WINDC</h3>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">
                                        Amount
                                        {windcBal && windcBal > 0n && (
                                            <button onClick={() => setStakeAmount(formatEther(windcBal))}
                                                className="ml-2 text-primary hover:underline">Max ({fmt(windcBal)})</button>
                                        )}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0.0"
                                        value={stakeAmount}
                                        onChange={(e) => setStakeAmount(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={handleStake}
                                    disabled={!address || !stakeAmountWei || staking || approvingWindc}
                                    className="w-full py-3 rounded-xl font-bold btn-gradient disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    {!address ? 'Connect Wallet' : approvingWindc ? 'Approving...' : staking ? 'Staking...' : 'Stake WINDC'}
                                </button>
                            </div>

                            {/* Unstake */}
                            {address && stakedAmt > 0n && (
                                <div className="glass-card p-5 space-y-3">
                                    <h3 className="font-bold">Unstake WINDC</h3>
                                    {lockEnd > 0n && fmtLockEnd(lockEnd) ? (
                                        <p className="text-yellow-400 text-xs">🔒 Locked — {fmtLockEnd(lockEnd)}</p>
                                    ) : (
                                        <p className="text-gray-400 text-xs">Auto-claims all pending rewards on unstake.</p>
                                    )}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">
                                            Amount
                                            <button onClick={() => setUnstakeAmount(formatEther(stakedAmt))}
                                                className="ml-2 text-primary hover:underline">Max ({fmt(stakedAmt)})</button>
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0.0"
                                            value={unstakeAmount}
                                            onChange={(e) => setUnstakeAmount(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleUnstake}
                                            disabled={!unstakeAmountWei || unstaking || (lockEnd > 0n && BigInt(Math.floor(Date.now() / 1000)) < lockEnd)}
                                            className="flex-1 py-3 rounded-xl font-bold btn-gradient disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            {unstaking ? 'Unstaking...' : lockEnd > 0n && BigInt(Math.floor(Date.now() / 1000)) < lockEnd ? '🔒 Locked' : 'Unstake'}
                                        </button>
                                        {emergencyEnabled && (
                                            <button
                                                onClick={handleEmergencyUnstake}
                                                disabled={emergencyUnstaking}
                                                className="px-4 py-3 rounded-xl font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 disabled:opacity-40 transition-all text-sm"
                                                title="Emergency unstake — forfeits all pending rewards"
                                            >
                                                {emergencyUnstaking ? '...' : '⚠ Emergency'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                

                {/* Solvency info footer */}
                <div


                    className="glass-card p-4 text-xs text-gray-500 space-y-1"
                >
                    <p className="font-semibold text-gray-400 mb-2">How solvency works</p>
                    <p>• 100% of WIND paid by buyers goes into the reserve</p>
                    <p>• Only 60% of minted tokens enter circulation — the other 40% go to stakers as rewards</p>
                    <p>• Because fewer tokens circulate than WIND in reserve, sellers can always be paid out</p>
                    <p>• The faster the price rises, the more tokens flow to stakers — rewarding long-term holders</p>
                    <p className="pt-1">
                        Reserve ratio: <span className={solvent ? 'text-green-400' : 'text-yellow-400'}>{reserveRatio > 0n ? (Number(reserveRatio) / 100).toFixed(2) + '%' : '—'}</span>
                        {' '}(≥100% = fully backed)
                    </p>
                </div>

            </div>
        </div>
    );
}
