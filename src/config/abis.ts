
// Minimal ABIs for WindSwap contracts
// These contain only the functions needed for the frontend

// MILK contract — USDC-backed bonding curve (0x6E0090dBecF3b4F0F9429637756CaDD8Fc468C54)
export const MILK_ABI = [
    {
        name: 'getBacking',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'totalSupply',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'lastPrice',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'sell_fee',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint16' }],
    },
    {
        name: 'getBuyFee',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'MILKtoUSDC',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'value', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'USDCtoMILK',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'value', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'getBuyAmount',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'start',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'buy',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'receiver', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'sell',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'milk', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'Loans',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [
            { name: 'collateral', type: 'uint256' },
            { name: 'borrowed', type: 'uint256' },
            { name: 'endDate', type: 'uint256' },
            { name: 'numberOfDays', type: 'uint256' },
        ],
    },
] as const;

export const ERC20_ABI = [
    {
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'symbol',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'name',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        name: 'allowance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// V2 Router ABI
export const ROUTER_ABI = [
    // Read functions
    {
        inputs: [],
        name: 'defaultFactory',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'weth',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountIn', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
        ],
        name: 'getAmountsOut',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountOut', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
        ],
        name: 'getAmountsIn',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'stable', type: 'bool' },
            { name: '_factory', type: 'address' },
        ],
        name: 'getReserves',
        outputs: [
            { name: 'reserveA', type: 'uint256' },
            { name: 'reserveB', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    // Swap functions
    {
        inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactTokensForTokens',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountOutMin', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactETHForTokens',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'amountInMax', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'swapTokensForExactTokens',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountOut', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'swapETHForExactTokens',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'amountInMax', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'swapTokensForExactETH',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            {
                components: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'stable', type: 'bool' },
                    { name: 'factory', type: 'address' },
                ],
                name: 'routes',
                type: 'tuple[]',
            },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactTokensForETH',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Add Liquidity
    {
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'stable', type: 'bool' },
            { name: 'amountADesired', type: 'uint256' },
            { name: 'amountBDesired', type: 'uint256' },
            { name: 'amountAMin', type: 'uint256' },
            { name: 'amountBMin', type: 'uint256' },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'addLiquidity',
        outputs: [
            { name: 'amountA', type: 'uint256' },
            { name: 'amountB', type: 'uint256' },
            { name: 'liquidity', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'stable', type: 'bool' },
            { name: 'amountTokenDesired', type: 'uint256' },
            { name: 'amountTokenMin', type: 'uint256' },
            { name: 'amountETHMin', type: 'uint256' },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'addLiquidityETH',
        outputs: [
            { name: 'amountToken', type: 'uint256' },
            { name: 'amountETH', type: 'uint256' },
            { name: 'liquidity', type: 'uint256' },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
    // Remove Liquidity
    {
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'stable', type: 'bool' },
            { name: 'liquidity', type: 'uint256' },
            { name: 'amountAMin', type: 'uint256' },
            { name: 'amountBMin', type: 'uint256' },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        name: 'removeLiquidity',
        outputs: [
            { name: 'amountA', type: 'uint256' },
            { name: 'amountB', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'stable', type: 'bool' },
            { name: '_factory', type: 'address' },
            { name: 'amountADesired', type: 'uint256' },
            { name: 'amountBDesired', type: 'uint256' },
        ],
        name: 'quoteAddLiquidity',
        outputs: [
            { name: 'amountA', type: 'uint256' },
            { name: 'amountB', type: 'uint256' },
            { name: 'liquidity', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// QuoterV2 ABI for getting swap quotes
export const QUOTER_V2_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'quoteExactInputSingle',
        outputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'sqrtPriceX96After', type: 'uint160' },
            { name: 'initializedTicksCrossed', type: 'uint32' },
            { name: 'gasEstimate', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'quoteExactOutputSingle',
        outputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'sqrtPriceX96After', type: 'uint160' },
            { name: 'initializedTicksCrossed', type: 'uint32' },
            { name: 'gasEstimate', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

// Pool Factory ABI
export const POOL_FACTORY_ABI = [
    {
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'stable', type: 'bool' },
        ],
        name: 'getPool',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'allPoolsLength',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'index', type: 'uint256' }],
        name: 'allPools',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// CL Factory ABI (Slipstream)
export const CL_FACTORY_ABI = [
    {
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'tickSpacing', type: 'int24' },
        ],
        name: 'getPool',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tickSpacing', type: 'int24' }, { name: 'fee', type: 'uint24' }],
        name: 'enableTickSpacing',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'owner',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tickSpacing', type: 'int24' }],
        name: 'tickSpacingToFee',
        outputs: [{ name: '', type: 'uint24' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Pool ABI
export const POOL_ABI = [
    {
        inputs: [],
        name: 'token0',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'token1',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'stable',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getReserves',
        outputs: [
            { name: '_reserve0', type: 'uint256' },
            { name: '_reserve1', type: 'uint256' },
            { name: '_blockTimestampLast', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// WETH ABI
export const WETH_ABI = [
    {
        inputs: [],
        name: 'deposit',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    ...ERC20_ABI,
] as const;

// NonfungiblePositionManager ABI (Slipstream CL)
export const NFT_POSITION_MANAGER_ABI = [
    // ERC721 functions
    {
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'index', type: 'uint256' },
        ],
        name: 'tokenOfOwnerByIndex',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // Multicall for batching operations
    {
        inputs: [{ name: 'data', type: 'bytes[]' }],
        name: 'multicall',
        outputs: [{ name: 'results', type: 'bytes[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    // Position info
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'positions',
        outputs: [
            { name: 'nonce', type: 'uint96' },
            { name: 'operator', type: 'address' },
            { name: 'token0', type: 'address' },
            { name: 'token1', type: 'address' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'tickLower', type: 'int24' },
            { name: 'tickUpper', type: 'int24' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'feeGrowthInside0LastX128', type: 'uint256' },
            { name: 'feeGrowthInside1LastX128', type: 'uint256' },
            { name: 'tokensOwed0', type: 'uint128' },
            { name: 'tokensOwed1', type: 'uint128' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    // Mint new position
    {
        inputs: [
            {
                components: [
                    { name: 'token0', type: 'address' },
                    { name: 'token1', type: 'address' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'tickLower', type: 'int24' },
                    { name: 'tickUpper', type: 'int24' },
                    { name: 'amount0Desired', type: 'uint256' },
                    { name: 'amount1Desired', type: 'uint256' },
                    { name: 'amount0Min', type: 'uint256' },
                    { name: 'amount1Min', type: 'uint256' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'sqrtPriceX96', type: 'uint160' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'mint',
        outputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'amount0', type: 'uint256' },
            { name: 'amount1', type: 'uint256' },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
    // Increase liquidity
    {
        inputs: [
            {
                components: [
                    { name: 'tokenId', type: 'uint256' },
                    { name: 'amount0Desired', type: 'uint256' },
                    { name: 'amount1Desired', type: 'uint256' },
                    { name: 'amount0Min', type: 'uint256' },
                    { name: 'amount1Min', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'increaseLiquidity',
        outputs: [
            { name: 'liquidity', type: 'uint128' },
            { name: 'amount0', type: 'uint256' },
            { name: 'amount1', type: 'uint256' },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
    // Decrease liquidity
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
        stateMutability: 'payable',
        type: 'function',
    },
    // Collect fees
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
        stateMutability: 'payable',
        type: 'function',
    },
    // Burn position NFT (requires liquidity=0 and all fees collected)
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'burn',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
] as const;

// V3 SwapRouter ABI (CL Swaps)
export const SWAP_ROUTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'amountOutMinimum', type: 'uint256' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'exactInputSingle',
        outputs: [{ name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    // Multicall for batching swap + unwrap
    {
        inputs: [{ name: 'data', type: 'bytes[]' }],
        name: 'multicall',
        outputs: [{ name: 'results', type: 'bytes[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    // Unwrap WETH to native ETH
    {
        inputs: [
            { name: 'amountMinimum', type: 'uint256' },
            { name: 'recipient', type: 'address' },
        ],
        name: 'unwrapWETH9',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    // ExactInput for multi-hop swaps
    {
        inputs: [
            {
                components: [
                    { name: 'path', type: 'bytes' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'amountOutMinimum', type: 'uint256' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'exactInput',
        outputs: [{ name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'amountOut', type: 'uint256' },
                    { name: 'amountInMaximum', type: 'uint256' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'exactOutputSingle',
        outputs: [{ name: 'amountIn', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { name: 'path', type: 'bytes' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'amountOut', type: 'uint256' },
                    { name: 'amountInMaximum', type: 'uint256' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'exactOutput',
        outputs: [{ name: 'amountIn', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
] as const;

// VotingEscrow ABI (veWIND locking)
export const VOTING_ESCROW_ABI = [
    // View functions
    {
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'locked',
        outputs: [
            {
                components: [
                    { name: 'amount', type: 'int128' },
                    { name: 'end', type: 'uint256' },
                    { name: 'isPermanent', type: 'bool' },
                ],
                name: '',
                type: 'tuple',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'balanceOfNFT',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: '_owner', type: 'address' },
            { name: '_index', type: 'uint256' },
        ],
        name: 'ownerToNFTokenIdList',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'voted',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    // Write functions
    {
        inputs: [
            { name: '_value', type: 'uint256' },
            { name: '_lockDuration', type: 'uint256' },
        ],
        name: 'createLock',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: '_tokenId', type: 'uint256' },
            { name: '_value', type: 'uint256' },
        ],
        name: 'increaseAmount',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: '_tokenId', type: 'uint256' },
            { name: '_lockDuration', type: 'uint256' },
        ],
        name: 'increaseUnlockTime',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'lockPermanent',
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
    {
        inputs: [
            { name: '_from', type: 'uint256' },
            { name: '_to', type: 'uint256' },
        ],
        name: 'merge',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;


// RewardsDistributor ABI (veNFT rebases)
export const REWARDS_DISTRIBUTOR_ABI = [
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'claimable',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'claim',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

// SugarHelper ABI - On-chain liquidity math helper
export const SUGAR_HELPER_ABI = [
    {
        inputs: [
            { name: 'amount0', type: 'uint256' },
            { name: 'pool', type: 'address' },
            { name: 'sqrtRatioX96', type: 'uint160' },
            { name: 'tickLow', type: 'int24' },
            { name: 'tickHigh', type: 'int24' },
        ],
        name: 'estimateAmount1',
        outputs: [{ name: 'amount1', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amount1', type: 'uint256' },
            { name: 'pool', type: 'address' },
            { name: 'sqrtRatioX96', type: 'uint160' },
            { name: 'tickLow', type: 'int24' },
            { name: 'tickHigh', type: 'int24' },
        ],
        name: 'estimateAmount0',
        outputs: [{ name: 'amount0', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tick', type: 'int24' }],
        name: 'getSqrtRatioAtTick',
        outputs: [{ name: 'sqrtRatioX96', type: 'uint160' }],
        stateMutability: 'pure',
        type: 'function',
    },
] as const;

// Extended Voter ABI for reading vote data
export const VOTER_EXTENDED_ABI = [
    {
        inputs: [
            { name: '_tokenId', type: 'uint256' },
            { name: '_pool', type: 'address' },
        ],
        name: 'votes',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'lastVoted',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_gauge', type: 'address' }],
        name: 'gaugeToBribe',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_pool', type: 'address' }],
        name: 'gauges',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_token', type: 'address' }],
        name: 'isWhitelistedToken',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Bribe Voting Reward ABI for adding incentives
export const BRIBE_VOTING_REWARD_ABI = [
    {
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'notifyRewardAmount',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'rewardsListLength',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'index', type: 'uint256' }],
        name: 'rewards',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// ============================================
// BTB Finance ABIs (Ethereum Mainnet)
// ============================================

// BTB Bear Token ABI (Wrapped BTB with 1% tax)
export const BTBB_TOKEN_ABI = [
    // ERC20 standard
    ...ERC20_ABI,
    // Mint BTBB by depositing BTB (1:1)
    {
        inputs: [{ name: 'btbAmount', type: 'uint256' }],
        name: 'mint',
        outputs: [{ name: 'btbbAmount', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Redeem BTB by burning BTBB (1:1)
    {
        inputs: [{ name: 'btbbAmount', type: 'uint256' }],
        name: 'redeem',
        outputs: [{ name: 'btbAmount', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Preview transfer to see net amount after 1% tax
    {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'previewTransfer',
        outputs: [
            { name: 'netAmount', type: 'uint256' },
            { name: 'taxAmount', type: 'uint256' },
        ],
        stateMutability: 'pure',
        type: 'function',
    },
    // Get pending fees in contract
    {
        inputs: [],
        name: 'pendingFees',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // Get contract stats
    {
        inputs: [],
        name: 'getStats',
        outputs: [
            { name: 'btbBalance', type: 'uint256' },
            { name: 'btbbSupply', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    // Get underlying BTB token
    {
        inputs: [],
        name: 'BTB_TOKEN',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Bear NFT ABI
export const BEAR_NFT_ABI = [
    // ERC721 standard functions
    {
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'index', type: 'uint256' },
        ],
        name: 'tokenOfOwnerByIndex',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // Approval functions
    {
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'operator', type: 'address' },
            { name: 'approved', type: 'bool' },
        ],
        name: 'setApprovalForAll',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'operator', type: 'address' },
        ],
        name: 'isApprovedForAll',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    // Bear NFT specific
    {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'buyNFT',
        outputs: [{ name: '', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'pricePerNFT',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'MAX_SUPPLY',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalMinted',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'remainingSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'getPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'tokenURI',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Bear Staking ABI
export const BEAR_STAKING_ABI = [
    // Stake NFTs
    {
        inputs: [{ name: 'tokenIds', type: 'uint256[]' }],
        name: 'stake',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Unstake NFTs
    {
        inputs: [{ name: 'count', type: 'uint256' }],
        name: 'unstake',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Claim rewards
    {
        inputs: [],
        name: 'claim',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Collect fees (anyone can call)
    {
        inputs: [],
        name: 'collectFees',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // View functions
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'pendingRewards',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'pendingRewardsNet',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'pendingRewardsDetailed',
        outputs: [
            { name: 'gross', type: 'uint256' },
            { name: 'net', type: 'uint256' },
            { name: 'taxAmount', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'stakedCountOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalStaked',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalRewardsDistributed',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'estimatedAPR',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getStats',
        outputs: [
            { name: '_totalStaked', type: 'uint256' },
            { name: '_totalRewardsDistributed', type: 'uint256' },
            { name: '_pendingToCollect', type: 'uint256' },
            { name: '_rewardsLast24h', type: 'uint256' },
            { name: '_estimatedAPR', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'getUserInfo',
        outputs: [
            { name: 'staked', type: 'uint256' },
            { name: 'pending', type: 'uint256' },
            { name: 'debt', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'poolSize',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'offset', type: 'uint256' },
            { name: 'limit', type: 'uint256' },
        ],
        name: 'getPoolTokensPaginated',
        outputs: [
            { name: 'tokens', type: 'uint256[]' },
            { name: 'total', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    // Contract addresses
    {
        inputs: [],
        name: 'bearNFT',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'btbbToken',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// ============================================
// Additional ABIs (consolidated from pages)
// ============================================

// Voter ABI for distribute and basic operations
export const VOTER_DISTRIBUTE_ABI = [
    {
        inputs: [{ name: '_start', type: 'uint256' }, { name: '_finish', type: 'uint256' }],
        name: 'distribute',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'length',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// CL Gauge ABI for staking/claiming
export const CL_GAUGE_ABI = [
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'deposit',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
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
    {
        inputs: [{ name: 'account', type: 'address' }, { name: 'tokenId', type: 'uint256' }],
        name: 'earned',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Factory Registry ABI
export const FACTORY_REGISTRY_ABI = [
    {
        inputs: [
            { name: 'poolFactory', type: 'address' },
            { name: 'votingRewardsFactory', type: 'address' },
            { name: 'gaugeFactory', type: 'address' },
        ],
        name: 'approve',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: 'poolFactory', type: 'address' }],
        name: 'unapprove',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'owner',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'poolFactory', type: 'address' }],
        name: 'isPoolFactoryApproved',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Minter ABI
export const MINTER_ABI = [
    {
        inputs: [],
        name: 'weeklyEmissions',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'weekly',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'tailEmissionRate',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'activePeriod',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'epochCount',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'teamRate',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'initialized',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'team',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'updatePeriod',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

// Voter ABI (for admin operations)
export const VOTER_ABI = [
    {
        inputs: [{ name: '_token', type: 'address' }, { name: '_bool', type: 'bool' }],
        name: 'whitelistToken',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }, { name: '_bool', type: 'bool' }],
        name: 'whitelistNFT',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_poolFactory', type: 'address' }, { name: '_pool', type: 'address' }],
        name: 'createGauge',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_token', type: 'address' }],
        name: 'isWhitelistedToken',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'governor',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_gauge', type: 'address' }],
        name: 'killGauge',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_pool', type: 'address' }],
        name: 'gauges',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'length',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_start', type: 'uint256' }, { name: '_finish', type: 'uint256' }],
        name: 'distribute',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: '_tokenId', type: 'uint256' },
            { name: '_poolVote', type: 'address[]' },
            { name: '_weights', type: 'uint256[]' },
        ],
        name: 'vote',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_tokenId', type: 'uint256' }],
        name: 'reset',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_governor', type: 'address' }],
        name: 'setGovernor',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

// Fee Reward ABI (for voting rewards)
export const FEE_REWARD_ABI = [
    {
        inputs: [{ name: 'token', type: 'address' }, { name: 'tokenId', type: 'uint256' }],
        name: 'earned',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'tokens', type: 'address[]' }],
        name: 'getReward',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;


// ============================================
// LOREBondingCurve ABI (Base)
// ============================================
export const LORE_BONDING_CURVE_ABI = [
    {
        type: 'function',
        name: 'buy',
        inputs: [],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'sell',
        inputs: [{ name: 'boreAmount', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getCurrentPrice',
        inputs: [],
        outputs: [{ name: 'price', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'previewBuy',
        inputs: [{ name: 'SEIAmount', type: 'uint256' }],
        outputs: [
            { name: 'boreAmount', type: 'uint256' },
            { name: 'price', type: 'uint256' },
            { name: 'fee', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'previewSell',
        inputs: [{ name: 'boreAmount', type: 'uint256' }],
        outputs: [
            { name: 'SEIAmount', type: 'uint256' },
            { name: 'price', type: 'uint256' },
            { name: 'fee', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getMarketInfo',
        inputs: [],
        outputs: [
            { name: 'currentPrice', type: 'uint256' },
            { name: 'circulatingSupply', type: 'uint256' },
            { name: 'SEIBacking', type: 'uint256' },
            { name: 'availableBORE', type: 'uint256' },
            { name: 'tradingFee', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getSEIReserve',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getLOREReserve',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getCirculatingSupply',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'tradingFeeBps',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'event',
        name: 'LOREBought',
        inputs: [
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'SEIAmount', type: 'uint256', indexed: false },
            { name: 'boreAmount', type: 'uint256', indexed: false },
            { name: 'price', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'LORESold',
        inputs: [
            { name: 'seller', type: 'address', indexed: true },
            { name: 'boreAmount', type: 'uint256', indexed: false },
            { name: 'SEIAmount', type: 'uint256', indexed: false },
            { name: 'price', type: 'uint256', indexed: false },
        ],
    },
] as const;

// ============================================
// LOREmining ABI (Base)
// ============================================
export const LORE_MINING_ABI = [
    // View functions
    {
        type: 'function',
        name: 'currentRoundId',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'roundDuration',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'startTime',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'endTime',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getCurrentRound',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'id', type: 'uint256' },
                    { name: 'startTime', type: 'uint256' },
                    { name: 'endTime', type: 'uint256' },
                    { name: 'deployed', type: 'uint256[25]' },
                    { name: 'minerCount', type: 'uint256[25]' },
                    { name: 'totalDeployed', type: 'uint256' },
                    { name: 'entropyHash', type: 'bytes32' },
                    { name: 'totalWinnings', type: 'uint256' },
                    { name: 'loreReward', type: 'uint256' },
                    { name: 'totalMotherlodeReward', type: 'uint256' },
                    { name: 'winningSquare', type: 'uint8' },
                    { name: 'motherlodeTiersHit', type: 'uint16' },
                    { name: 'finalized', type: 'bool' },
                    { name: 'isCheckpointable', type: 'bool' },
                    { name: 'isJackpotRound', type: 'bool' },
                    { name: 'timerStarted', type: 'bool' },
                    { name: '__deprecated_finalizationRequested', type: 'bool' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getRound',
        inputs: [{ name: 'roundId', type: 'uint256' }],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'id', type: 'uint256' },
                    { name: 'startTime', type: 'uint256' },
                    { name: 'endTime', type: 'uint256' },
                    { name: 'deployed', type: 'uint256[25]' },
                    { name: 'minerCount', type: 'uint256[25]' },
                    { name: 'totalDeployed', type: 'uint256' },
                    { name: 'entropyHash', type: 'bytes32' },
                    { name: 'totalWinnings', type: 'uint256' },
                    { name: 'loreReward', type: 'uint256' },
                    { name: 'totalMotherlodeReward', type: 'uint256' },
                    { name: 'winningSquare', type: 'uint8' },
                    { name: 'motherlodeTiersHit', type: 'uint16' },
                    { name: 'finalized', type: 'bool' },
                    { name: 'isCheckpointable', type: 'bool' },
                    { name: 'isJackpotRound', type: 'bool' },
                    { name: 'timerStarted', type: 'bool' },
                    { name: '__deprecated_finalizationRequested', type: 'bool' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getMinerRoundData',
        inputs: [
            { name: 'roundId', type: 'uint256' },
            { name: 'miner', type: 'address' },
        ],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'deployed', type: 'uint256[25]' },
                    { name: 'hasCheckpointed', type: 'bool' },
                    { name: 'rewardsSei', type: 'uint256' },
                    { name: 'rewardsLore', type: 'uint256' },
                    { name: 'refinedLore', type: 'uint256' },
                    { name: 'lastRewardsFactor', type: 'uint256' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'minerStats',
        inputs: [{ name: 'miner', type: 'address' }],
        outputs: [
            { name: 'unclaimedSei', type: 'uint256' },
            { name: 'unclaimedLore', type: 'uint256' },
            { name: 'refinedLore', type: 'uint256' },
            { name: 'lastRewardsFactor', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getTotalClaimableBalance',
        inputs: [{ name: 'miner', type: 'address' }],
        outputs: [
            { name: 'totalSei', type: 'uint256' },
            { name: 'totalLore', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getAllMotherloadePots',
        inputs: [],
        outputs: [{ name: 'pots', type: 'uint256[10]' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getCurrentRoundTimeRemaining',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getSquareDeployment',
        inputs: [
            { name: 'roundId', type: 'uint256' },
            { name: 'square', type: 'uint8' },
        ],
        outputs: [
            { name: 'totalDeployed', type: 'uint256' },
            { name: 'minerCount', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'loreToken',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'bondingCurveAddress',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getMinerLoreBreakdown',
        inputs: [{ name: 'miner', type: 'address' }],
        outputs: [
            { name: 'unclaimedLore', type: 'uint256' },
            { name: 'refinedLore', type: 'uint256' },
            { name: 'pendingRefined', type: 'uint256' },
            { name: 'totalClaimable', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    // Write functions
    {
        type: 'function',
        name: 'deploy',
        inputs: [
            { name: 'squares', type: 'uint8[]' },
            { name: 'amountPerSquare', type: 'uint256' },
            { name: 'partner', type: 'address' },
            { name: 'userRandom', type: 'bytes32' },
        ],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'finalizeRound',
        inputs: [{ name: 'userRandom', type: 'bytes32' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'checkpoint',
        inputs: [{ name: 'roundId', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'claimSei',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'claimLore',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'claimAll',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    // Events
    {
        type: 'event',
        name: 'RoundStarted',
        inputs: [
            { name: 'roundId', type: 'uint256', indexed: true },
            { name: 'startTime', type: 'uint256', indexed: false },
            { name: 'endTime', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'Deployed',
        inputs: [
            { name: 'roundId', type: 'uint256', indexed: true },
            { name: 'miner', type: 'address', indexed: true },
            { name: 'squares', type: 'uint8[]', indexed: false },
            { name: 'amountPerSquare', type: 'uint256', indexed: false },
            { name: 'totalAmount', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'RoundFinalized',
        inputs: [
            { name: 'roundId', type: 'uint256', indexed: true },
            { name: 'winningSquare', type: 'uint8', indexed: false },
            { name: 'totalWinnings', type: 'uint256', indexed: false },
            { name: 'loreReward', type: 'uint256', indexed: false },
            { name: 'totalMotherlodeReward', type: 'uint256', indexed: false },
            { name: 'motherlodeTiersHit', type: 'uint16', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'RewardsClaimed',
        inputs: [
            { name: 'miner', type: 'address', indexed: true },
            { name: 'seiAmount', type: 'uint256', indexed: false },
            { name: 'loreAmount', type: 'uint256', indexed: false },
            { name: 'refinedLore', type: 'uint256', indexed: false },
            { name: 'claimFee', type: 'uint256', indexed: false },
        ],
    },
] as const;

// Wind Bonding Curve ABI (DevFeeTokenBondingCurve)
export const WIND_BONDING_CURVE_ABI = [
    { inputs: [], name: 'getCurrentPrice', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'amount', type: 'uint256' }], name: 'getBuyInfo', outputs: [{ name: 'totalBtbCost', type: 'uint256' }, { name: 'userTokens', type: 'uint256' }, { name: 'devTokens', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'windBudget', type: 'uint256' }], name: 'getMaxBuyForBudget', outputs: [{ name: 'maxTokens', type: 'uint256' }, { name: 'actualCost', type: 'uint256' }, { name: 'userReceives', type: 'uint256' }, { name: 'toStakers', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'totalAmount', type: 'uint256' }], name: 'getSellInfo', outputs: [{ name: 'btbReturn', type: 'uint256' }, { name: 'tokensBurned', type: 'uint256' }, { name: 'tokensLocked', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'getMarketInfo', outputs: [{ name: 'currentPrice', type: 'uint256' }, { name: 'supply', type: 'uint256' }, { name: 'reserve', type: 'uint256' }, { name: 'lockedBalance', type: 'uint256' }, { name: 'circulatingSupply', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'getReserveHealth', outputs: [{ name: 'reserve', type: 'uint256' }, { name: 'circulatingSupply', type: 'uint256' }, { name: 'lockedSupply', type: 'uint256' }, { name: 'totalSupplyAll', type: 'uint256' }, { name: 'reserveRatio', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'user', type: 'address' }], name: 'getUserInfo', outputs: [{ name: 'userBalance', type: 'uint256' }, { name: 'wouldBurn', type: 'uint256' }, { name: 'wouldLock', type: 'uint256' }, { name: 'wouldReceiveBtb', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'fromSupply', type: 'uint256' }, { name: 'amount', type: 'uint256' }], name: 'calculateCost', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
    { inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'amount', type: 'uint256' }], name: 'buy', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [{ name: 'totalAmount', type: 'uint256' }], name: 'sell', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'btb', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'devWallet', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'DEV_FEE_PERCENT', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'SELL_PERCENT', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'INCREMENT', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'buyer', type: 'address', indexed: true }, { name: 'totalTokensMinted', type: 'uint256', indexed: false }, { name: 'userReceived', type: 'uint256', indexed: false }, { name: 'devLocked', type: 'uint256', indexed: false }, { name: 'btbPaid', type: 'uint256', indexed: false }], name: 'Buy', type: 'event' },
    { inputs: [{ name: 'seller', type: 'address', indexed: true }, { name: 'totalTokensUsed', type: 'uint256', indexed: false }, { name: 'tokensBurned', type: 'uint256', indexed: false }, { name: 'tokensLocked', type: 'uint256', indexed: false }, { name: 'btbReceived', type: 'uint256', indexed: false }], name: 'Sell', type: 'event' },
] as const;

// Wind Staking ABI (CurveTokenStaking)
export const WIND_STAKING_ABI = [
    { inputs: [], name: 'getGlobalInfo', outputs: [{ name: '_totalStaked', type: 'uint256' }, { name: '_rewardRate', type: 'uint256' }, { name: '_periodFinish', type: 'uint256' }, { name: '_rewardPerToken', type: 'uint256' }, { name: '_rewardPool', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'account', type: 'address' }], name: 'getUserInfo', outputs: [{ name: 'staked', type: 'uint256' }, { name: 'earnedRewards', type: 'uint256' }, { name: 'lockEnd', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'getAPR', outputs: [{ name: 'apr', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'getRewardPool', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'totalStaked', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'rewardRate', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'periodFinish', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'REWARD_DURATION', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'amount', type: 'uint256' }], name: 'stake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [{ name: 'amount', type: 'uint256' }], name: 'unstake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'claimRewards', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'emergencyUnstake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'emergencyUnstakeEnabled', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'enabled', type: 'bool' }], name: 'setEmergencyUnstakeEnabled', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }], name: 'Staked', type: 'event' },
    { inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }], name: 'Unstaked', type: 'event' },
    { inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }], name: 'RewardsClaimed', type: 'event' },
] as const;

// TickLens ABI - fetches populated tick data for liquidity depth visualization
export const TICK_LENS_ABI = [
    {
        inputs: [
            { name: 'pool', type: 'address' },
            { name: 'tickBitmapIndex', type: 'int16' },
        ],
        name: 'getPopulatedTicksInWord',
        outputs: [
            {
                components: [
                    { name: 'tick', type: 'int24' },
                    { name: 'sqrtRatioX96', type: 'uint160' },
                    { name: 'liquidityNet', type: 'int128' },
                    { name: 'liquidityGross', type: 'uint128' },
                ],
                name: 'populatedTicks',
                type: 'tuple[]',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// WindSwap Aggregator Proxy ABI
export const AGGREGATOR_PROXY_ABI = [
    {
        inputs: [
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'minAmountOut', type: 'uint256' },
            { name: 'router', type: 'address' },
            { name: 'callData', type: 'bytes' },
        ],
        name: 'swap',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'feeBps',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'tokenIn', type: 'address' },
            {
                name: 'orders',
                type: 'tuple[]',
                components: [
                    { name: 'tokenOut', type: 'address' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'minAmountOut', type: 'uint256' },
                    { name: 'router', type: 'address' },
                    { name: 'callData', type: 'bytes' },
                ],
            },
            { name: 'recipient', type: 'address' },
        ],
        name: 'bulkSwap',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                name: 'orders',
                type: 'tuple[]',
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'minAmountOut', type: 'uint256' },
                    { name: 'router', type: 'address' },
                    { name: 'callData', type: 'bytes' },
                ],
            },
            { name: 'tokenOut', type: 'address' },
            { name: 'recipient', type: 'address' },
        ],
        name: 'bulkSell',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
] as const;
