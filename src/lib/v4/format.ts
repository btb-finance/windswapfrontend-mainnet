import { formatUnits, parseUnits } from 'viem';

/** Formats a base-unit amount for display, e.g. 1234500000000000000000n (18 dec) -> "1,234.5". */
export function formatTokenAmount(raw: bigint, decimals: number, maxFractionDigits = 4): string {
  const value = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(value)) return formatUnits(raw, decimals);
  if (value !== 0 && value < 10 ** -maxFractionDigits) return `<${(10 ** -maxFractionDigits).toString()}`;
  return value.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
}

/** Parses a user-typed decimal into base units. Returns null when empty or invalid. */
export function parseTokenAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '.') return null;
  try {
    const value = parseUnits(trimmed.endsWith('.') ? `${trimmed}0` : trimmed, decimals);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

/** Human-readable price with significant digits, for price ranges and pool prices. */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value === 0) return '0';
  if (value >= 1e6 || value < 1e-4) return value.toExponential(4);
  return value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
}

/** Fee in hundredths of a bip (300 = 0.03%). */
export function formatFeeBps(fee: number): string {
  return `${(fee / 10000).toFixed(fee % 100 === 0 ? 2 : 4)}%`;
}
