'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { useWriteContract } from '@/hooks/useWriteContract';
import { useBatchTransactions } from '@/hooks/useBatchTransactions';

const JACKPOT_ADDRESS = '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2' as const;
const NFT_ADDRESS = '0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4' as const;
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const REFERRER = '0xfed2Ff614E0289D41937139730B49Ee158D02299' as const;
const REFERRAL_SPLIT = [1000000000000000000n] as const;
const SOURCE = ('0x' + '77696e6473776170'.padEnd(64, '0')) as `0x${string}`;

const JACKPOT_ABI = [
    {
        name: 'currentDrawingId',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'getDrawingState',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_drawingId', type: 'uint256' }],
        outputs: [
            {
                type: 'tuple',
                components: [
                    { name: 'prizePool', type: 'uint256' },
                    { name: 'ticketPrice', type: 'uint256' },
                    { name: 'edgePerTicket', type: 'uint256' },
                    { name: 'referralFee', type: 'uint256' },
                    { name: 'referralWinShare', type: 'uint256' },
                    { name: 'totalTicketsSold', type: 'uint256' },
                    { name: 'lpEarnings', type: 'uint256' },
                    { name: 'drawingTimestamp', type: 'uint256' },
                    { name: 'winningTicketPacked', type: 'uint256' },
                    { name: 'normalBallMax', type: 'uint8' },
                    { name: 'bonusBallMax', type: 'uint8' },
                ],
            },
        ],
    },
    {
        name: 'buyTickets',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: '_tickets',
                type: 'tuple[]',
                components: [
                    { name: 'normals', type: 'uint8[]' },
                    { name: 'bonusball', type: 'uint8' },
                ],
            },
            { name: '_recipient', type: 'address' },
            { name: '_referrers', type: 'address[]' },
            { name: '_referralSplit', type: 'uint256[]' },
            { name: '_source', type: 'bytes32' },
        ],
        outputs: [{ type: 'uint256[]' }],
    },
    {
        name: 'referralFees',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'claimReferralFees',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
    },
    {
        name: 'claimWinnings',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: '_userTicketIds', type: 'uint256[]' }],
        outputs: [],
    },
] as const;

const NFT_ABI = [
    {
        name: 'getUserTickets',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'drawingId', type: 'uint256' },
        ],
        outputs: [
            {
                type: 'tuple[]',
                components: [
                    { name: 'ticketId', type: 'uint256' },
                    {
                        name: 'ticket',
                        type: 'tuple',
                        components: [
                            { name: 'drawingId', type: 'uint256' },
                            { name: 'packedTicket', type: 'uint256' },
                            { name: 'referralScheme', type: 'bytes32' },
                        ],
                    },
                    { name: 'normals', type: 'uint8[]' },
                    { name: 'bonusball', type: 'uint8' },
                ],
            },
        ],
    },
] as const;

const USDC_ABI = [
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
] as const;

// ─── types ───────────────────────────────────────────────────────────────────

interface TicketEntry {
    normals: number[];
    bonusball: number | null;
}

type Tab = 'buy' | 'mytickets' | 'rewards';

// ─── helpers ─────────────────────────────────────────────────────────────────

function emptyTicket(): TicketEntry {
    return { normals: [], bonusball: null };
}

function randomTicket(normalBallMax: number, bonusBallMax: number): TicketEntry {
    const pool = Array.from({ length: normalBallMax }, (_, i) => i + 1);
    const normals: number[] = [];
    while (normals.length < 5) {
        const idx = Math.floor(Math.random() * pool.length);
        normals.push(pool.splice(idx, 1)[0]);
    }
    return { normals: normals.sort((a, b) => a - b), bonusball: Math.floor(Math.random() * bonusBallMax) + 1 };
}

function isComplete(t: TicketEntry) {
    return t.normals.length === 5 && t.bonusball !== null;
}

function formatUSDC(val: bigint | undefined | null): string {
    if (val === undefined || val === null) return '—';
    return `$${Number(formatUnits(val, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function BallButton({ num, selected, onClick, bonus }: {
    num: number; selected: boolean; onClick: () => void; bonus?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-9 h-9 rounded-full text-sm font-bold transition-all duration-75 border
                ${selected
                    ? bonus
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-400 text-black scale-110 shadow-lg shadow-amber-500/30'
                        : 'bg-gradient-to-br from-indigo-500 to-violet-600 border-indigo-400 text-white scale-110 shadow-lg shadow-indigo-500/30'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
        >
            {num}
        </button>
    );
}

function Ball({ n, bonus }: { n: number; bonus?: boolean }) {
    return (
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
            ${bonus
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-black'
                : 'bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-white'
            }`}>
            {n}
        </span>
    );
}

function TicketPicker({ index, ticket, normalBallMax, bonusBallMax, onChange, onRandomize, onClear, totalTickets, defaultOpen }: {
    index: number;
    ticket: TicketEntry;
    normalBallMax: number;
    bonusBallMax: number;
    onChange: (t: TicketEntry) => void;
    onRandomize: () => void;
    onClear: () => void;
    totalTickets: number;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen ?? !isComplete(ticket));

    const toggleNormal = (n: number) => {
        const next = ticket.normals.includes(n)
            ? ticket.normals.filter(x => x !== n)
            : ticket.normals.length < 5
            ? [...ticket.normals, n].sort((a, b) => a - b)
            : ticket.normals;
        onChange({ ...ticket, normals: next });
    };

    const complete = isComplete(ticket);

    return (
        <div className={`rounded-2xl border transition-colors ${complete ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-white/[0.03] border-white/8'}`}>
            {/* Header row — always visible, click to toggle */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3.5 gap-3"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${complete ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                        {index + 1}
                    </span>
                    {complete ? (
                        /* show picked numbers inline when collapsed */
                        <div className="flex items-center gap-1 flex-wrap">
                            {ticket.normals.map((n, idx) => <Ball key={idx} n={n} />)}
                            <span className="text-gray-600 mx-0.5 text-xs">+</span>
                            {ticket.bonusball !== null && <Ball n={ticket.bonusball} bonus />}
                        </div>
                    ) : (
                        <span className="text-sm text-gray-400">
                            {ticket.normals.length > 0
                                ? `${ticket.normals.length}/5 picked${ticket.bonusball !== null ? ' + bonus' : ''}`
                                : 'Pick numbers'}
                        </span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expandable body */}
            {open && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                    <div className="flex justify-end gap-2">
                        <button onClick={onRandomize} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors font-medium">
                            Quick Pick
                        </button>
                        <button onClick={onClear} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10 transition-colors">
                            Clear
                        </button>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Normal Balls — {ticket.normals.length}/5</p>
                        <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: normalBallMax }, (_, i) => i + 1).map(n => (
                                <BallButton key={n} num={n} selected={ticket.normals.includes(n)} onClick={() => toggleNormal(n)} />
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Bonus Ball — {ticket.bonusball !== null ? '1/1' : '0/1'}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: bonusBallMax }, (_, i) => i + 1).map(n => (
                                <BallButton key={n} num={n} selected={ticket.bonusball === n} onClick={() => onChange({ ...ticket, bonusball: ticket.bonusball === n ? null : n })} bonus />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── main component ───────────────────────────────────────────────────────────

export function MegapotCard() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { batchOrSequential, buildApproveCallIfNeeded, encodeContractCall } = useBatchTransactions();

    const [tab, setTab] = useState<Tab>('buy');
    const [tickets, setTickets] = useState<TicketEntry[]>([emptyTicket()]);
    const [pickGen, setPickGen] = useState(0); // bumped after Quick Pick All to collapse all rows
    const [buyStatus, setBuyStatus] = useState<'idle' | 'buying' | 'success' | 'error'>('idle');
    const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
    const [claimWinStatus, setClaimWinStatus] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

    // ── contract reads ──────────────────────────────────────────────────────

    const { data: drawingId } = useReadContract({
        address: JACKPOT_ADDRESS,
        abi: JACKPOT_ABI,
        functionName: 'currentDrawingId',
    });

    const { data: drawingState } = useReadContract({
        address: JACKPOT_ADDRESS,
        abi: JACKPOT_ABI,
        functionName: 'getDrawingState',
        args: drawingId !== undefined ? [drawingId] : undefined,
        query: { enabled: drawingId !== undefined },
    });

    const { data: usdcBalance } = useReadContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });


    const { data: userTickets, refetch: refetchTickets } = useReadContract({
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: 'getUserTickets',
        args: address && drawingId !== undefined ? [address, drawingId] : undefined,
        query: { enabled: !!address && drawingId !== undefined },
    });

    const { data: referralFeesRaw, refetch: refetchFees } = useReadContract({
        address: JACKPOT_ADDRESS,
        abi: JACKPOT_ABI,
        functionName: 'referralFees',
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    // ── derived ─────────────────────────────────────────────────────────────

    const ticketPrice = drawingState?.ticketPrice ?? 0n;
    const prizePool = drawingState?.prizePool ?? 0n;
    const normalBallMax = drawingState?.normalBallMax ?? 30;
    const bonusBallMax = drawingState?.bonusBallMax ?? 20;
    const totalCost = ticketPrice * BigInt(tickets.length);
    const allComplete = tickets.every(isComplete);
    const canBuy = isConnected && allComplete && ticketPrice > 0n;
    const referralFees = referralFeesRaw ?? 0n;
    const hasReferralFees = referralFees > 0n;

    // ── ticket management ───────────────────────────────────────────────────

    const updateTicket = (i: number, t: TicketEntry) =>
        setTickets(prev => prev.map((x, idx) => (idx === i ? t : x)));

    const randomizeTicket = (i: number) =>
        setTickets(prev => prev.map((x, idx) => (idx === i ? randomTicket(normalBallMax, bonusBallMax) : x)));

    const clearTicket = (i: number) =>
        setTickets(prev => prev.map((x, idx) => (idx === i ? emptyTicket() : x)));

    const removeTicket = (i: number) => {
        if (tickets.length > 1) setTickets(prev => prev.filter((_, idx) => idx !== i));
    };

    // ── buy ─────────────────────────────────────────────────────────────────

    const handleBuy = async () => {
        if (!address || !canBuy) return;
        setErrorMsg('');
        setBuyStatus('buying');
        try {
            const contractTickets = tickets.map(t => ({
                normals: t.normals as number[],
                bonusball: t.bonusball as number,
            }));

            const approveCall = await buildApproveCallIfNeeded(USDC_ADDRESS, JACKPOT_ADDRESS, totalCost);
            const buyCall = encodeContractCall(
                JACKPOT_ADDRESS,
                JACKPOT_ABI as any,
                'buyTickets',
                [contractTickets, address, [REFERRER], [...REFERRAL_SPLIT], SOURCE],
            );

            const calls = approveCall ? [approveCall, buyCall] : [buyCall];
            const hash = await batchOrSequential(calls);
            setTxHash(hash as `0x${string}`);
            setBuyStatus('success');
            refetchTickets();
        } catch (e: any) {
            setBuyStatus('error');
            setErrorMsg(e?.shortMessage ?? e?.message ?? 'Transaction failed');
        }
    };

    // ── claim referral fees ─────────────────────────────────────────────────

    const handleClaimFees = async () => {
        if (!address || !hasReferralFees) return;
        setClaimStatus('claiming');
        try {
            await writeContractAsync({
                address: JACKPOT_ADDRESS,
                abi: JACKPOT_ABI,
                functionName: 'claimReferralFees',
                args: [],
            });
            setClaimStatus('success');
            refetchFees();
        } catch (e: any) {
            setClaimStatus('error');
        }
    };

    // ── claim winnings ──────────────────────────────────────────────────────

    const handleClaimWinnings = async (ticketIds: bigint[]) => {
        if (!address || ticketIds.length === 0) return;
        setClaimWinStatus('claiming');
        try {
            await writeContractAsync({
                address: JACKPOT_ADDRESS,
                abi: JACKPOT_ABI,
                functionName: 'claimWinnings',
                args: [ticketIds],
            });
            setClaimWinStatus('success');
            refetchTickets();
        } catch (e: any) {
            setClaimWinStatus('error');
        }
    };

    const resetBuy = () => {
        setBuyStatus('idle');
        setErrorMsg('');
        setTxHash(undefined);
        setTickets([emptyTicket()]);
    };

    // ── render ───────────────────────────────────────────────────────────────

    return (
        <div className="max-w-xl mx-auto space-y-4">
            {/* Header stats */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5 border border-amber-500/20 p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Megapot Lottery</h2>
                            <p className="text-xs text-gray-400">Daily USDC jackpot on Base</p>
                        </div>
                    </div>
                    <a href="https://megapot.io" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
                        megapot.io
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold text-amber-400">{formatUSDC(prizePool)}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Prize Pool</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold text-white">{formatUSDC(ticketPrice)}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Per Ticket</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold text-indigo-400">
                            {drawingState?.totalTicketsSold !== undefined ? Number(drawingState.totalTicketsSold).toLocaleString() : '—'}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Tickets Sold</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-white/5 border border-white/8 p-1 gap-1">
                {([
                    { key: 'buy', label: 'Buy Tickets' },
                    { key: 'mytickets', label: `My Tickets${userTickets && userTickets.length > 0 ? ` (${userTickets.length})` : ''}` },
                    { key: 'rewards', label: `Rewards${hasReferralFees ? ' ●' : ''}` },
                ] as { key: Tab; label: string }[]).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-75
                            ${tab === t.key
                                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── BUY TAB ── */}
            {tab === 'buy' && (
                buyStatus === 'success' ? (
                    <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-6 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                            <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-lg font-bold text-white">{tickets.length} Ticket{tickets.length > 1 ? 's' : ''} Purchased!</p>
                            <p className="text-sm text-gray-400 mt-1">Good luck! Check your tickets below.</p>
                        </div>
                        {txHash && (
                            <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                View on Basescan
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                        <div className="flex gap-3">
                            <button onClick={resetBuy} className="btn-secondary flex-1 py-2.5 text-sm font-semibold">
                                Buy More
                            </button>
                            <button onClick={() => { resetBuy(); setTab('mytickets'); }} className="btn-gradient flex-1 py-2.5 text-sm font-semibold">
                                View My Tickets
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Quantity selector */}
                        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-white">How many tickets?</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setTickets(prev => prev.length > 1 ? prev.slice(0, -1) : prev)}
                                        disabled={tickets.length <= 1}
                                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-lg font-bold"
                                    >
                                        −
                                    </button>
                                    <span className="text-xl font-bold text-white w-6 text-center">{tickets.length}</span>
                                    <button
                                        onClick={() => setTickets(prev => [...prev, emptyTicket()])}
                                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center text-lg font-bold"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => { setTickets(prev => prev.map(() => randomTicket(normalBallMax, bonusBallMax))); setPickGen(g => g + 1); }}
                                className="w-full py-2.5 rounded-xl border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors text-sm font-semibold bg-indigo-500/5 flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Quick Pick All {tickets.length > 1 ? `(${tickets.length} tickets)` : ''}
                            </button>
                        </div>

                        {/* Ticket pickers — collapsible */}
                        {tickets.map((ticket, i) => (
                            <TicketPicker
                                key={`${i}-${pickGen}`}
                                index={i}
                                ticket={ticket}
                                normalBallMax={normalBallMax}
                                bonusBallMax={bonusBallMax}
                                onChange={t => updateTicket(i, t)}
                                onRandomize={() => randomizeTicket(i)}
                                onClear={() => clearTicket(i)}
                                totalTickets={tickets.length}
                                defaultOpen={!isComplete(ticket)}
                            />
                        ))}

                        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                    {tickets.length} ticket{tickets.length > 1 ? 's' : ''} · {tickets.filter(isComplete).length} ready
                                </span>
                                <span className="text-sm font-bold text-white">{formatUSDC(totalCost)}</span>
                            </div>

                            {isConnected && usdcBalance !== undefined && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">USDC balance</span>
                                    <span className={`text-xs font-medium ${usdcBalance >= totalCost && totalCost > 0n ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatUSDC(usdcBalance)}
                                    </span>
                                </div>
                            )}

                            {buyStatus === 'error' && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-xs text-red-400">
                                    {errorMsg || 'Transaction failed. Please try again.'}
                                </div>
                            )}

                            {!isConnected ? (
                                <div className="text-center py-3 text-sm text-gray-500">Connect wallet to buy tickets</div>
                            ) : (
                                <button
                                    onClick={handleBuy}
                                    disabled={!canBuy || buyStatus === 'buying'}
                                    className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-75
                                        ${canBuy && buyStatus === 'idle'
                                            ? 'btn-gradient hover:scale-[1.02] active:scale-[0.98]'
                                            : 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed'
                                        }`}
                                >
                                    {buyStatus === 'buying' ? 'Confirm in wallet…'
                                        : !allComplete ? `Complete all tickets to continue`
                                        : `Buy ${tickets.length} Ticket${tickets.length > 1 ? 's' : ''} — ${formatUSDC(totalCost)}`}
                                </button>
                            )}

                            <p className="text-[10px] text-gray-600 text-center">
                                Powered by Megapot · Draws happen daily · USDC on Base
                            </p>
                        </div>
                    </div>
                )
            )}

            {/* ── MY TICKETS TAB ── */}
            {tab === 'mytickets' && (
                <div className="space-y-3">
                    {!isConnected ? (
                        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-8 text-center text-sm text-gray-500">
                            Connect wallet to see your tickets
                        </div>
                    ) : !userTickets ? (
                        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-8 text-center text-sm text-gray-500">
                            Loading tickets…
                        </div>
                    ) : userTickets.length === 0 ? (
                        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-8 text-center space-y-3">
                            <p className="text-sm text-gray-400">No tickets for this drawing yet.</p>
                            <button onClick={() => setTab('buy')} className="btn-gradient px-6 py-2.5 text-sm font-semibold">
                                Buy Tickets
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Draw info banner */}
                            {drawingState && (
                                <div className="rounded-xl bg-indigo-500/8 border border-indigo-500/15 px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <p className="text-xs font-semibold text-white">
                                                Drawing #{drawingId?.toString()}
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                {drawingState.drawingTimestamp > 0n
                                                    ? new Date(Number(drawingState.drawingTimestamp) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                                    : 'Draw time TBA'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-indigo-300 font-semibold">
                                        {userTickets.length} ticket{userTickets.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}

                            {/* Ticket list */}
                            <div className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
                                {userTickets.map((t, idx) => (
                                    <div key={t.ticketId.toString()} className={`px-4 py-3.5 flex items-center justify-between gap-4 ${idx !== userTickets.length - 1 ? 'border-b border-white/5' : ''}`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-[10px] text-gray-600 w-5 shrink-0 font-medium">#{idx + 1}</span>
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {t.normals.map((n, i) => <Ball key={i} n={n} />)}
                                                <span className="text-gray-600 text-xs mx-0.5">+</span>
                                                <Ball n={t.bonusball} bonus />
                                            </div>
                                        </div>
                                        <span
                                            className="text-[10px] text-gray-600 shrink-0 font-mono hidden sm:block"
                                            title={`#${t.ticketId.toString()}`}
                                        >
                                            {t.ticketId.toString().slice(0, 4)}…{t.ticketId.toString().slice(-4)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Claim winnings */}
                            <button
                                onClick={() => handleClaimWinnings(userTickets.map(t => t.ticketId))}
                                disabled={claimWinStatus === 'claiming' || claimWinStatus === 'success'}
                                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-75
                                    ${claimWinStatus === 'idle'
                                        ? 'btn-gradient hover:scale-[1.02] active:scale-[0.98]'
                                        : 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed'
                                    }`}
                            >
                                {claimWinStatus === 'claiming' ? 'Claiming…'
                                    : claimWinStatus === 'success' ? 'Winnings Claimed!'
                                    : `Claim Winnings (${userTickets.length} ticket${userTickets.length > 1 ? 's' : ''})`}
                            </button>

                            {claimWinStatus === 'error' && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-xs text-red-400">
                                    No winnings to claim, or draw hasn't happened yet.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── REWARDS TAB ── */}
            {tab === 'rewards' && (
                <div className="space-y-3">
                    {!isConnected ? (
                        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-8 text-center text-sm text-gray-500">
                            Connect wallet to see rewards
                        </div>
                    ) : (
                        <>
                            {/* Referral fees */}
                            <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                        </svg>
                                        <h3 className="text-sm font-semibold text-white">Referral Earnings</h3>
                                    </div>
                                    <span className={`text-2xl font-bold ${hasReferralFees ? 'text-green-400' : 'text-gray-500'}`}>{formatUSDC(referralFees)}</span>
                                </div>

                                <button
                                    onClick={handleClaimFees}
                                    disabled={!hasReferralFees || claimStatus === 'claiming'}
                                    className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-75
                                        ${hasReferralFees && claimStatus === 'idle'
                                            ? 'btn-gradient hover:scale-[1.02] active:scale-[0.98]'
                                            : 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed'
                                        }`}
                                >
                                    {claimStatus === 'claiming' ? 'Claiming…'
                                        : claimStatus === 'success' ? 'Claimed!'
                                        : !hasReferralFees ? 'No referral earnings yet'
                                        : `Claim ${formatUSDC(referralFees)}`}
                                </button>

                                {claimStatus === 'error' && (
                                    <p className="text-xs text-red-400">Claim failed. Please try again.</p>
                                )}
                            </div>

                            {/* Ticket winnings — only show claim if user has tickets */}
                            {userTickets && userTickets.length > 0 && (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                            <h3 className="text-sm font-semibold text-white">Ticket Winnings</h3>
                                        </div>
                                        <span className="text-xs text-gray-500">{userTickets.length} ticket{userTickets.length > 1 ? 's' : ''}</span>
                                    </div>

                                    {drawingState && drawingState.drawingTimestamp > 0n && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Draw: {new Date(Number(drawingState.drawingTimestamp) * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => handleClaimWinnings(userTickets.map(t => t.ticketId))}
                                        disabled={claimWinStatus === 'claiming' || claimWinStatus === 'success'}
                                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-75
                                            ${claimWinStatus === 'idle'
                                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                                                : 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed'
                                            }`}
                                    >
                                        {claimWinStatus === 'claiming' ? 'Claiming…'
                                            : claimWinStatus === 'success' ? 'Claimed!'
                                            : 'Claim Winnings'}
                                    </button>

                                    {claimWinStatus === 'error' && (
                                        <p className="text-xs text-gray-500">No winnings to claim — draw may not have happened yet.</p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
