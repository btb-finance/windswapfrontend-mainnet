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

/** Unix seconds as a local date and time, e.g. "29 Oct 2026, 00:00". */
export function formatUnixDate(sec: number): string {
  return new Date(sec * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Seconds as a short countdown, e.g. "2d 04h 13m". Zero or less shows "now". */
export function formatCountdown(sec: number): string {
  if (sec <= 0) return 'now';
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

/** Shortens a 0x or owner hex string for display. */
export function shortHex(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}
