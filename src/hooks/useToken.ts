'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatUnits, Address } from 'viem';
import { ERC20_ABI } from '@/config/abis';
import { Token } from '@/config/tokens';

export function truncateToDecimals(numStr: string, decimals: number = 4): string {
    if (!numStr) return '0';
    const parts = numStr.split('.');
    if (parts.length === 1) return parts[0];
    return `${parts[0]}.${parts[1].slice(0, decimals)}`;
}

export function bigIntPercentage(amount: bigint | undefined, percentage: number): bigint {
    if (!amount) return BigInt(0);
    return (amount * BigInt(percentage)) / BigInt(100);
}

export function useTokenBalance(token: Token | undefined) {
    const { address } = useAccount();

    // For native SEI
    const { data: nativeBalance, refetch: refetchNative } = useBalance({
        address: address,
        query: {
            enabled: !!address && !!token?.isNative,
        },
    });

    // For ERC20 tokens
    const { data: tokenBalance, refetch: refetchToken } = useReadContract({
        address: token?.address as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && !!token && !token.isNative,
        },
    });

    // Get the raw bigint value
    const rawBigInt = token?.isNative
        ? nativeBalance?.value
        : tokenBalance as bigint | undefined;

    // Format with full precision for calculations
    const balance = rawBigInt !== undefined && token
        ? formatUnits(rawBigInt, token.decimals || 18)
        : undefined;

    const refetch = () => {
        if (token?.isNative) {
            refetchNative();
        } else {
            refetchToken();
        }
    };

    return {
        balance,
        rawBigInt, // Actual bigint for precise calculations
        raw: balance || '0', // Full precision string for MAX button
        formatted: balance ? truncateToDecimals(balance, 4) : '--',
        refetch,
    };
}

export function useTokenAllowance(
    token: Token | undefined,
    spender: Address | undefined
) {
    const { address } = useAccount();

    const { data: allowance, refetch } = useReadContract({
        address: token?.address as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && spender ? [address, spender] : undefined,
        query: {
            enabled: !!address && !!token && !!spender && !token.isNative,
        },
    });

    return {
        allowance: allowance as bigint | undefined,
        refetch,
    };
}
