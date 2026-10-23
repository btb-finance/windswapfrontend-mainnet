'use client';

import { V4Banner } from '@/components/v4/V4Banner';
import { useV4Query } from '@/hooks/v4/useV4Query';
import { ownerViews, type TokenAccounting } from '@/lib/v4/owner-views';
import { internalTokenSymbol } from '@/lib/v4/config';
import { formatTokenAmount } from '@/lib/v4/format';

/** Internal token balances are 18 decimals (see V4_INTERNAL_TOKENS). */
const DECIMALS = 18;

/**
 * Per-token accounting from `get_all_tokens_accounting`: what the DEX owes (balances, pool reserves,
 * locks, pending withdrawals) and how much of it is not backed by a deposit (`unbacked`).
 */
export function V4Solvency() {
  const accounting = useV4Query('accounting', ownerViews.getAllTokensAccounting, 60_000);
  const rows = accounting.data ?? [];
  const migrated = rows.some((r) => r.migrated);

  return (
    <div className="swap-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Solvency</h2>
          <p className="text-xs text-gray-400">What the DEX owes per token, from the contract&apos;s accounting.</p>
        </div>
        <button onClick={accounting.refresh} className="btn-secondary px-3 py-1.5 text-xs">Refresh</button>
      </div>

      {accounting.error && <V4Banner tone="error">{accounting.error}</V4Banner>}
      {migrated && (
        <V4Banner tone="warning">
          Pool reserves are not seeded yet on this contract version (migrated). The pool-reserve figures read 0, so the totals
          are incomplete until the owner seeds them.
        </V4Banner>
      )}
      {accounting.data && rows.length === 0 && <p className="text-sm text-gray-400">No tokens yet.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 text-left">
              <tr>
                <th className="py-2 pr-3 font-medium">Token</th>
                <th className="py-2 pr-3 font-medium text-right">Balances</th>
                <th className="py-2 pr-3 font-medium text-right">Pools</th>
                <th className="py-2 pr-3 font-medium text-right">Locked</th>
                <th className="py-2 pr-3 font-medium text-right">Pending out</th>
                <th className="py-2 pr-3 font-medium text-right">Total owed</th>
                <th className="py-2 font-medium text-right">Unbacked</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <AccountingRow key={r.token} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AccountingRow({ row }: { row: TokenAccounting }) {
  const fmt = (v: string) => formatTokenAmount(BigInt(v), DECIMALS, 2);
  return (
    <tr className="border-t border-white/10">
      <td className="py-2 pr-3 font-sans font-semibold">{internalTokenSymbol(row.token)}</td>
      <td className="py-2 pr-3 text-right">{fmt(row.liabilities)}</td>
      <td className="py-2 pr-3 text-right">{fmt(row.pool_reserves)}</td>
      <td className="py-2 pr-3 text-right">{fmt(row.locked)}</td>
      <td className="py-2 pr-3 text-right">{fmt(row.pending_withdrawals)}</td>
      <td className="py-2 pr-3 text-right">{fmt(row.total_owed)}</td>
      <td className="py-2 text-right">{fmt(row.unbacked)}</td>
    </tr>
  );
}
