'use client';

import type { V4Token } from '@/lib/v4/config';

interface V4TokenFieldProps {
  label: string;
  token?: V4Token;
  /** Input value. Ignored when `readOnly`. */
  value: string;
  onChange?: (value: string) => void;
  /** Formatted balance text, shown next to the label. */
  balance?: string;
  onMax?: () => void;
  readOnly?: boolean;
  placeholder?: string;
  /** Secondary line under the input, e.g. a USD-like value or a hint. */
  hint?: string;
}

/** Amount field styled like the EVM `TokenInput` (same CSS classes). Tokens are fixed, so no selector. */
export function V4TokenField({ label, token, value, onChange, balance, onMax, readOnly, placeholder = '0.0', hint }: V4TokenFieldProps) {
  return (
    <div className="token-input-row">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        {balance !== undefined && (
          <span className="text-sm text-gray-400">
            Balance: {balance}
            {onMax && (
              <button onClick={onMax} className="ml-2 text-primary hover:text-primary/80 font-medium" aria-label="Set maximum amount">
                MAX
              </button>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(e) => {
            const next = e.target.value;
            if (onChange && (next === '' || /^\d*\.?\d*$/.test(next))) onChange(next);
          }}
          className="flex-1 min-w-0 bg-transparent text-xl md:text-2xl font-medium outline-none border-none ring-0 focus:outline-none focus:ring-0 placeholder-gray-600"
          aria-label={`${label} amount`}
        />
        <div className="token-select cursor-default" aria-label={`Token ${token?.symbol ?? ''}`}>
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xs font-bold">
            {token?.symbol.charAt(1) ?? '?'}
          </div>
          <span>{token?.symbol ?? '-'}</span>
        </div>
      </div>
      {hint && <div className="mt-2 text-sm text-gray-500">{hint}</div>}
    </div>
  );
}
