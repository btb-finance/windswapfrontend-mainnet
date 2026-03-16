// Application-wide constants

// Time constants (in seconds unless noted)
export const TIME = {
    SECONDS_PER_HOUR: 3600,
    SECONDS_PER_DAY: 86400,
    SECONDS_PER_WEEK: 604800,
} as const;

export const DEBOUNCE_MS = {
  QUOTE: 400,        // Increased to reduce RPC calls while keeping UX snappy
  INPUT: 100,        // Reduced for more responsive typing
  SEARCH: 150,       // Reduced for faster search results
  SLIPPAGE: 200,     // Debounce for slippage changes
} as const;

export const SLIPPAGE = {
  MIN: 0.1, // 0.1%
  MAX: 50, // 50%
  DEFAULT: 0.5, // 0.5%
  PRESETS: [0.1, 0.5, 1, 3, 5], // Common slippage options
} as const;

export const DEADLINE = {
  MIN: 1, // 1 minute
  MAX: 60 * 24, // 24 hours
  DEFAULT: 30, // 30 minutes
} as const;

export const TOKEN = {
  MIN_DECIMALS: 6,
  MAX_DECIMALS: 18,
  MAX_SYMBOL_LENGTH: 11,
  MAX_NAME_LENGTH: 32,
} as const;

export const CHAIN = {
  SEI_CHAIN_ID: 1329 as const,
} as const;

export const TRANSACTION = {
  SIMULATION_TIMEOUT: 10000, // 10 seconds
  CONFIRMATION_BLOCKS: 1,
} as const;

export const UI = {
  TOAST_DURATION: 4000, // 4 seconds
  TOAST_SUCCESS_DURATION: 3000,
  TOAST_ERROR_DURATION: 6000,
} as const;

// Additional common constants
export const ANIMATION = {
  DURATION: 150, // ms
  DELAY: 50, // ms
} as const;

export const ACCESSIBILITY = {
  MIN_TOUCH_TARGET: 44, // px - WCAG 2.5.5 AAA standard
  MAX_WIDTH: 1920, // px - Mobile breakpoint
} as const;
