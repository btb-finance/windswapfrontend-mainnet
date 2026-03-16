/**
 * Toast notification helpers
 * Centralized toast messages for consistent UX
 * 
 * Usage:
 * import { toastErrors, toastSuccess } from '@/utils/toastHelpers';
 * 
 * // Instead of: alert('Error message')
 * // Use: toast.error(toastErrors.insufficientBalance)
 */

import { useToast } from '@/providers/ToastProvider';

// Error messages - use these instead of inline strings
export const toastErrors = {
  // Wallet errors
  walletNotConnected: 'Please connect your wallet first',
  wrongNetwork: 'Please switch to Sei Network',
  
  // Balance errors
  insufficientBalance: 'Insufficient balance for this transaction',
  insufficientAllowance: 'Please approve token spending first',
  
  // veWIND errors
  needVeNFT: 'You need veWIND to perform this action',
  needPermanentLock: 'You need a permanent lock veNFT for governance',
  alreadyVoted: 'You have already voted this epoch',
  lockNotExpired: 'Your lock has not expired yet',
  
  // Transaction errors
  transactionFailed: 'Transaction failed. Please try again.',
  userRejected: 'Transaction cancelled',
  slippageExceeded: 'Slippage tolerance exceeded. Try increasing slippage.',
  noRouteFound: 'No route found for this token pair',
  
  // Validation errors
  invalidAddress: 'Invalid address format',
  invalidAmount: 'Please enter a valid amount',
  noAmount: 'Please enter an amount',
  
  // Generic
  somethingWrong: 'Something went wrong. Please try again.',
  networkError: 'Network error. Please check your connection.',
} as const;

// Success messages
export const toastSuccess = {
  // Transaction success
  swapComplete: 'Swap successful!',
  liquidityAdded: 'Liquidity added successfully!',
  liquidityRemoved: 'Liquidity removed successfully!',
  
  // veWIND success
  lockCreated: 'WIND locked successfully!',
  lockExtended: 'Lock extended successfully!',
  lockIncreased: 'Lock amount increased!',
  lockWithdrawn: 'WIND withdrawn successfully!',
  mergedLocks: 'veNFTs merged successfully!',
  
  // Voting success
  voteCast: 'Vote cast successfully!',
  incentiveAdded: 'Incentive added successfully!',
  
  // Staking success
  staked: 'Staked successfully!',
  unstaked: 'Unstaked successfully!',
  rewardsClaimed: 'Rewards claimed!',
  
  // Generic
  transactionSubmitted: 'Transaction submitted!',
  approvalComplete: 'Approval complete!',
} as const;

// Info messages
export const toastInfo = {
  pendingApproval: 'Approving token...',
  pendingSwap: 'Swapping...',
  pendingLiquidity: 'Adding liquidity...',
  pendingStake: 'Staking...',
  pendingVote: 'Casting vote...',
  pendingWithdraw: 'Withdrawing...',
} as const;

/**
 * Get user-friendly error message from error object
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // User rejected
    if (message.includes('user rejected') || message.includes('user denied') || message.includes('user cancelled')) {
      return toastErrors.userRejected;
    }
    
    // Insufficient balance
    if (message.includes('insufficient balance') || message.includes('exceeds balance')) {
      return toastErrors.insufficientBalance;
    }
    
    // Network error
    if (message.includes('network') || message.includes('rpc') || message.includes('timeout')) {
      return toastErrors.networkError;
    }
    
    // Slippage
    if (message.includes('slippage') || message.includes('price impact')) {
      return toastErrors.slippageExceeded;
    }
    
    return error.message || toastErrors.somethingWrong;
  }
  
  return toastErrors.somethingWrong;
}

/**
 * Hook to use toast with predefined messages
 * 
 * @example
 * const { error, success } = useToastMessages();
 * error('insufficientBalance'); // Shows "Insufficient balance for this transaction"
 */
export function useToastMessages() {
  const toast = useToast();
  
  return {
    error: (key: keyof typeof toastErrors | string) => {
      const message = key in toastErrors 
        ? toastErrors[key as keyof typeof toastErrors] 
        : key;
      toast.error(message);
    },
    success: (key: keyof typeof toastSuccess | string) => {
      const message = key in toastSuccess 
        ? toastSuccess[key as keyof typeof toastSuccess] 
        : key;
      toast.success(message);
    },
    info: (key: keyof typeof toastInfo | string) => {
      const message = key in toastInfo 
        ? toastInfo[key as keyof typeof toastInfo] 
        : key;
      toast.info(message);
    },
    fromError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  };
}