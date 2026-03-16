/**
 * Error handling utilities for Wind Swap
 */

export type ErrorType = 'network' | 'transaction' | 'validation' | 'user' | 'unknown';

export interface AppError {
  message: string;
  type: ErrorType;
  code?: string;
  originalError?: unknown;
}

/**
 * Parse and categorize error messages from various sources
 */
export function parseError(error: unknown): AppError {
  // String error
  if (typeof error === 'string') {
    return categorizeError(error);
  }

  // Error object with message
  if (error instanceof Error) {
    return categorizeError(error.message, error);
  }

  // Object with message property
  if (error && typeof error === 'object' && 'message' in error) {
    return categorizeError(String(error.message), error);
  }

  // Unknown error
  return {
    message: 'An unexpected error occurred',
    type: 'unknown',
    originalError: error,
  };
}

/**
 * Categorize error based on message content
 */
function categorizeError(message: string, originalError?: unknown): AppError {
  const lowerMessage = message.toLowerCase();

  // User rejected transaction
  if (lowerMessage.includes('user rejected') ||
      lowerMessage.includes('user denied') ||
      lowerMessage.includes('user cancelled')) {
    return {
      message: 'Transaction cancelled',
      type: 'user',
      originalError,
    };
  }

  // Insufficient balance
  if (lowerMessage.includes('insufficient balance') ||
      lowerMessage.includes('exceeds balance') ||
      lowerMessage.includes('not enough')) {
    return {
      message: 'Insufficient balance',
      type: 'validation',
      originalError,
    };
  }

  // Insufficient allowance
  if (lowerMessage.includes('insufficient allowance') ||
      lowerMessage.includes('allowance')) {
    return {
      message: 'Please approve token spending first',
      type: 'transaction',
      originalError,
    };
  }

  // Network errors
  if (lowerMessage.includes('network') ||
      lowerMessage.includes('rpc') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('connection')) {
    return {
      message: 'Network error. Please check your connection.',
      type: 'network',
      originalError,
    };
  }

  // Gas estimation failed
  if (lowerMessage.includes('gas estimation') ||
      lowerMessage.includes('gas required')) {
    return {
      message: 'Transaction may fail. Please try again.',
      type: 'transaction',
      originalError,
    };
  }

  // Slippage tolerance exceeded
  if (lowerMessage.includes('slippage') ||
      lowerMessage.includes('min output')) {
    return {
      message: 'Price changed. Try increasing slippage.',
      type: 'validation',
      originalError,
    };
  }

  // Truncate long error messages
  const displayMessage = message.length > 100
    ? message.slice(0, 100) + '...'
    : message;

  return {
    message: displayMessage,
    type: 'unknown',
    originalError,
  };
}

/**
 * Get a user-friendly error message for swap operations
 */
export function getSwapErrorMessage(error: string | Error | unknown): string {
  const parsed = parseError(error);
  return parsed.message;
}

/**
 * Check if error is a user rejection (should not show as error toast)
 */
export function isUserRejection(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.type === 'user';
}

/**
 * Check if error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  const parsed = parseError(error);
  return ['network', 'transaction'].includes(parsed.type);
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: unknown): string {
  const parsed = parseError(error);
  return `[${parsed.type.toUpperCase()}] ${parsed.message}${
    parsed.originalError ? ` | Original: ${String(parsed.originalError)}` : ''
  }`;
}
