'use client';

import { useState, memo, useCallback } from 'react';
import { Token } from '@/config/tokens';
import { TokenSelector } from '@/components/common/TokenSelector';

interface TokenInputProps {
    label: string;
    token?: Token;
    amount: string;
    onAmountChange: (amount: string) => void;
    onTokenSelect: (token: Token) => void;
    excludeToken?: Token;
    disabled?: boolean;
    showMaxButton?: boolean;
    balance?: string;
    rawBalance?: string;
    usdValue?: string;
}

function TokenInputComponent({
    label,
    token,
    amount,
    onAmountChange,
    onTokenSelect,
    excludeToken,
    disabled = false,
    showMaxButton = false,
    balance = '--',
    rawBalance,
    usdValue,
}: TokenInputProps) {
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            onAmountChange(value);
        }
    }, [onAmountChange]);

    const handleMax = useCallback(() => {
        const maxValue = rawBalance || balance;
        if (maxValue && maxValue !== '--' && maxValue !== '0') {
            onAmountChange(maxValue);
        }
    }, [rawBalance, balance, onAmountChange]);

    const handleTokenSelect = useCallback((selectedToken: Token) => {
        onTokenSelect(selectedToken);
        setIsSelectorOpen(false);
    }, [onTokenSelect]);

    const handleCloseSelector = useCallback(() => {
        setIsSelectorOpen(false);
    }, []);

    const handleOpenSelector = useCallback(() => {
        setIsSelectorOpen(true);
    }, []);

    return (
        <>
            <div className="token-input-row">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className="text-sm text-gray-400">
                        Balance: {balance}
                        {showMaxButton && balance !== '--' && (
                            <button
                                onClick={handleMax}
                                className="ml-2 text-primary hover:text-primary/80 font-medium"
                                aria-label="Set maximum amount"
                            >
                                MAX
                            </button>
                        )}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={handleAmountChange}
                        placeholder="0.0"
                        disabled={disabled}
                        className="flex-1 min-w-0 bg-transparent text-xl md:text-2xl font-medium outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:border-none placeholder-gray-600"
                        aria-label={`Enter ${label.toLowerCase()} amount`}
                    />

                    <button
                        onClick={handleOpenSelector}
                        className="token-select transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        aria-label="Select token"
                    >
                        {token ? (
                            <>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                                    {token.logoURI ? (
                                        <img
                                            src={token.logoURI}
                                            alt={token.symbol}
                                            className="w-5 h-5 rounded-full"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <span className="text-xs font-bold">{token.symbol[0]}</span>
                                    )}
                                </div>
                                <span>{token.symbol}</span>
                            </>
                        ) : (
                            <span className="text-primary">Select</span>
                        )}
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>
                </div>

                {usdValue && (
                    <div className="mt-2 text-sm text-gray-500">≈ ${usdValue}</div>
                )}
            </div>

            <TokenSelector
                isOpen={isSelectorOpen}
                onClose={handleCloseSelector}
                onSelect={handleTokenSelect}
                selectedToken={token}
                excludeToken={excludeToken}
            />
        </>
    );
}

export const TokenInput = memo(TokenInputComponent);
