'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Address, formatUnits } from 'viem'
import { motion } from 'framer-motion'
import { useOldPositions, OldPosition, OldVeNFT, OldStakedPosition } from '@/hooks/useOldPositions'
import { OLD_V2_CONTRACTS, OLD_CL_CONTRACTS } from '@/config/oldContracts'
import { useWriteContract } from '@/hooks/useWriteContract'

const MAX_UINT128 = BigInt('340282366920938463463374607431768211455')

const DECREASE_LIQUIDITY_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'decreaseLiquidity',
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const COLLECT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'amount0Max', type: 'uint128' },
          { name: 'amount1Max', type: 'uint128' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'collect',
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const CL_GAUGE_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getReward',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const VE_ABI = [
  {
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    name: 'unlockPermanent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

function CollapsibleSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        <span className="text-sm font-medium text-white">
          {title}{' '}
          <span className="text-amber-400/70 ml-1">({count})</span>
        </span>
        <svg
          className={`w-4 h-4 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

export default function MigrationBanner() {
  const { address, isConnected } = useAccount()
  const {
    oldWindBalance,
    oldPositions,
    oldStakedPositions,
    oldVeNFTs,
    isLoading,
    refetch,
  } = useOldPositions(address)

  const { writeContractAsync } = useWriteContract()

  const [pendingAction, setPendingAction] = useState<string | null>(null)

  if (!isConnected || !address) return null

  const unstakedPositions = (oldPositions ?? []).filter((p: OldPosition) => !p.staked)
  const hasOldWind = oldWindBalance != null && oldWindBalance !== '0'
  const hasOldCL = unstakedPositions.length > 0
  const hasStaked = (oldStakedPositions ?? []).length > 0
  const hasVeNFTs = (oldVeNFTs ?? []).length > 0
  const hasAnything = hasOldWind || hasOldCL || hasStaked || hasVeNFTs

  if (isLoading) {
    return (
      <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-6 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-1/3 mb-3" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    )
  }

  if (!hasAnything) return null

  const now = BigInt(Math.floor(Date.now() / 1000))

  async function handleRemoveLiquidity(position: OldPosition) {
    const key = `remove-${position.tokenId}`
    setPendingAction(key)
    try {
      const hasLiquidity = BigInt(position.liquidity) > 0n
      if (hasLiquidity) {
        await writeContractAsync({
          address: OLD_CL_CONTRACTS.NonfungiblePositionManager as Address,
          abi: DECREASE_LIQUIDITY_ABI,
          functionName: 'decreaseLiquidity',
          args: [
            {
              tokenId: BigInt(position.tokenId),
              liquidity: BigInt(position.liquidity),
              amount0Min: 0n,
              amount1Min: 0n,
              deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
            },
          ],
        })
      }
      await writeContractAsync({
        address: OLD_CL_CONTRACTS.NonfungiblePositionManager as Address,
        abi: COLLECT_ABI,
        functionName: 'collect',
        args: [
          {
            tokenId: BigInt(position.tokenId),
            recipient: address!,
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128,
          },
        ],
      })
      await refetch()
    } catch (e) {
      console.error('Remove liquidity failed:', e)
    } finally {
      setPendingAction(null)
    }
  }

  async function handleUnstakeAndWithdraw(sp: OldStakedPosition) {
    const key = `unstake-${sp.tokenId}`
    setPendingAction(key)
    try {
      await writeContractAsync({
        address: sp.gaugeAddress as Address,
        abi: CL_GAUGE_ABI,
        functionName: 'getReward',
        args: [BigInt(sp.tokenId)],
      })
      await writeContractAsync({
        address: sp.gaugeAddress as Address,
        abi: CL_GAUGE_ABI,
        functionName: 'withdraw',
        args: [BigInt(sp.tokenId)],
      })
      await refetch()
    } catch (e) {
      console.error('Unstake failed:', e)
    } finally {
      setPendingAction(null)
    }
  }

  async function handleVeWithdraw(ve: OldVeNFT) {
    const key = `ve-withdraw-${ve.tokenId}`
    setPendingAction(key)
    try {
      await writeContractAsync({
        address: OLD_V2_CONTRACTS.VotingEscrow as Address,
        abi: VE_ABI,
        functionName: 'withdraw',
        args: [BigInt(ve.tokenId)],
      })
      await refetch()
    } catch (e) {
      console.error('veNFT withdraw failed:', e)
    } finally {
      setPendingAction(null)
    }
  }

  async function handleUnlockPermanent(ve: OldVeNFT) {
    const key = `ve-unlock-${ve.tokenId}`
    setPendingAction(key)
    try {
      await writeContractAsync({
        address: OLD_V2_CONTRACTS.VotingEscrow as Address,
        abi: VE_ABI,
        functionName: 'unlockPermanent',
        args: [BigInt(ve.tokenId)],
      })
      await refetch()
    } catch (e) {
      console.error('Unlock permanent failed:', e)
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.05] to-transparent p-6 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>⚠️</span> Migrate from Old Contracts
        </h2>
        <p className="text-sm text-white/50 mt-1">
          You have positions on the previous Wind Swap deployment that need to be migrated.
        </p>
      </div>

      <div className="space-y-3">
        {hasOldWind && (
          <CollapsibleSection title="Old WIND Tokens" count={1}>
            <div className="bg-white/[0.03] rounded-xl p-4">
              <p className="text-white text-sm">
                Balance:{' '}
                <span className="text-amber-400 font-medium">
                  {formatUnits(BigInt(oldWindBalance ?? '0'), 18)} WIND
                </span>
              </p>
              <p className="text-white/40 text-xs mt-2">
                Old WIND tokens need to be migrated to the new WIND token. Contact the team for
                token migration.
              </p>
            </div>
          </CollapsibleSection>
        )}

        {hasOldCL && (
          <CollapsibleSection title="Old CL Positions" count={unstakedPositions.length}>
            {unstakedPositions.map((pos: OldPosition) => {
              const hasLiquidity = BigInt(pos.liquidity) > 0n
              const owed0 = BigInt(pos.tokensOwed0 || '0')
              const owed1 = BigInt(pos.tokensOwed1 || '0')
              const hasClaimable = owed0 > 0n || owed1 > 0n
              const isClaimOnly = !hasLiquidity && hasClaimable

              return (
                <div
                  key={pos.tokenId.toString()}
                  className="bg-white/[0.03] rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {pos.token0.symbol}/{pos.token1.symbol}
                      {isClaimOnly && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded ml-2">
                          FEES READY
                        </span>
                      )}
                    </p>
                    {hasLiquidity ? (
                      <p className="text-white/40 text-xs mt-0.5">
                        ~${Number(pos.amountUSD).toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-white/40 text-xs mt-0.5">
                        Claimable: {Number(formatUnits(owed0, pos.token0.decimals)).toFixed(4)} {pos.token0.symbol}
                        {owed1 > 0n && ` + ${Number(formatUnits(owed1, pos.token1.decimals)).toFixed(4)} ${pos.token1.symbol}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveLiquidity(pos)}
                    disabled={pendingAction === `remove-${pos.tokenId}`}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingAction === `remove-${pos.tokenId}` ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                        {isClaimOnly ? 'Claiming...' : 'Removing...'}
                      </span>
                    ) : (
                      isClaimOnly ? 'Claim Fees' : 'Remove Liquidity'
                    )}
                  </button>
                </div>
              )
            })}
          </CollapsibleSection>
        )}

        {hasStaked && (
          <CollapsibleSection title="Old Staked Positions" count={oldStakedPositions!.length}>
            {oldStakedPositions!.map((sp: OldStakedPosition) => (
              <div
                key={sp.tokenId.toString()}
                className="bg-white/[0.03] rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-white text-sm font-medium">
                    {sp.token0.symbol}/{sp.token1.symbol}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Earned: {(() => { try { return Number(formatUnits(BigInt(sp.earned || '0'), 18)).toFixed(4); } catch { return Number(sp.earned).toFixed(4); } })()} WIND
                  </p>
                </div>
                <button
                  onClick={() => handleUnstakeAndWithdraw(sp)}
                  disabled={pendingAction === `unstake-${sp.tokenId}`}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingAction === `unstake-${sp.tokenId}` ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                      Unstaking...
                    </span>
                  ) : (
                    'Unstake & Withdraw'
                  )}
                </button>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {hasVeNFTs && (
          <CollapsibleSection title="Old veNFTs" count={oldVeNFTs!.length}>
            {oldVeNFTs!.map((ve: OldVeNFT) => {
              const lockEnd = BigInt(ve.lockEnd)
              const expired = lockEnd < now
              const lockDate = new Date(Number(lockEnd) * 1000)

              return (
                <div
                  key={ve.tokenId.toString()}
                  className="bg-white/[0.03] rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white text-sm font-medium flex items-center gap-2">
                      {Number(ve.lockedAmount).toFixed(4)} WIND
                      {ve.isPermanent && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                          PERMANENT
                        </span>
                      )}
                    </p>
                    {!ve.isPermanent && (
                      <p className="text-white/40 text-xs mt-0.5">
                        {expired
                          ? 'Lock expired'
                          : `Lock expires: ${lockDate.toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                  <div>
                    {ve.isPermanent ? (
                      <button
                        onClick={() => handleUnlockPermanent(ve)}
                        disabled={pendingAction === `ve-unlock-${ve.tokenId}`}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pendingAction === `ve-unlock-${ve.tokenId}` ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                            Unlocking...
                          </span>
                        ) : (
                          'Unlock & Withdraw'
                        )}
                      </button>
                    ) : expired ? (
                      <button
                        onClick={() => handleVeWithdraw(ve)}
                        disabled={pendingAction === `ve-withdraw-${ve.tokenId}`}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pendingAction === `ve-withdraw-${ve.tokenId}` ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                            Withdrawing...
                          </span>
                        ) : (
                          'Withdraw'
                        )}
                      </button>
                    ) : (
                      <span className="text-white/30 text-xs">
                        Lock expires: {lockDate.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </CollapsibleSection>
        )}
      </div>
    </motion.div>
  )
}
