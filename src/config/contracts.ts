// Wind Swap Contract Addresses - Base
// All contracts deployed via CreateX CREATE3 with vanity addresses

// ============================================
// V2 Core Contracts
// ============================================
export const V2_CONTRACTS = {
    // Protocol Token (WIND)
    WIND: '0x888859FEaAb4922DFBB9Add836172ec6f38caBb2',
    YAKA: '0x888859FEaAb4922DFBB9Add836172ec6f38caBb2', // Legacy alias

    // Core Voting Escrow
    VotingEscrow: '0x88889e34e5Eb7a8F0f986DDce5f2711220A0c02F',

    // Router for V2 swaps and liquidity
    Router: '0x88880576315176b632b0D7a4DD291d6b5e317692',

    // Voter for gauge voting
    Voter: '0x888843352588d670F0e0c009Ec276d5F055aE9Ed',

    // Token minter
    Minter: '0x88882CEe351fA534C1b2DB2c72A6762F6c80c4BC',

    // V2 Pool Factory
    PoolFactory: '0x88881EF7Fd02FaC4C3321bb9f65Be887008290f0',

    // Pool implementation
    Pool: '0x8888f98b168dA48a0cb5C6Ba20A132Cf1149E579',

    // Rewards distributor for veNFT rebases
    RewardsDistributor: '0x88881105D16f242B791fE8D713C254D3992b2A6E',

    // Factory registry
    FactoryRegistry: '0x8888500b00C5f5eCCa7BbCD2fFB04619F6b8b4cc',

    // Gauge Factory
    GaugeFactory: '0x8888fc8623ca00349e4f947Dd99330F3AF75a941',

    // Voting Rewards Factory
    VotingRewardsFactory: '0x888834b351dfE9953Ddac7c427640B0Ff70Fc34D',

    // Managed Rewards Factory
    ManagedRewardsFactory: '0x888890188ea6473c0E31AB762140F49D4368B96D',

    // VeArt Proxy for NFT art
    VeArtProxy: '0x8888232436766e1b6EEabC37ff7913ee3D90A455',

    // Airdrop Distributor
    AirdropDistributor: '0x88888EE2c6e04586a1DfE15e5e89eD1288149e68',

    // Forwarder
    Forwarder: '0x888886dDfbb2aDa679c70F03907D1c789b991593',

    // StablecoinZap (stub)
    StablecoinZap: '0x0000000000000000000000000000000000000000',

    // Governance (stubs)
    ProtocolGovernor: '0x0000000000000000000000000000000000000000',
    EpochGovernor: '0x0000000000000000000000000000000000000000',
} as const;

// ============================================
// V2 Libraries
// ============================================
export const V2_LIBRARIES = {
    PerlinNoise: '0x8888C66B93A3217d19b625A7A8ccE528A268Dbed',
    Trig: '0x88881F4e88922d05ad6E0b482F483398a921B4b7',
    BalanceLogicLibrary: '0x888890Fa180cA82BfFe132dB159B8B94f3fC0edD',
    DelegationLogicLibrary: '0x8888AeB5726d29A114829f86165dCE7bbBD6a636',
} as const;

// ============================================
// Slipstream (Concentrated Liquidity) Contracts
// ============================================
export const CL_CONTRACTS = {
    CLFactory: '0x88888493d3e3a133cB80da23610f23a6D563D083',
    CLPool: '0x8888001A78925a533ebd01efFdF5538B75D95D07',
    CLGaugeFactory: '0x888898D1d00867F2FEe511A30Fa56913F8e88728',
    CLGauge: '0x8888bb5ef5428eB7c3Bb71663E630a9f696fDBE0',
    SwapRouter: '0x8888bf918c9c97cAD175a3A2037451f471a479E6',
    NonfungiblePositionManager: '0x8888ef0BbF7aF08bBbaca8d6596F8Df18C78AE19',
    NonfungibleTokenPositionDescriptor: '0x8888F243B25dA58f97Ffb885872Dc4D369903408',
    QuoterV2: '0x8888eda381972e924F9331413a3BF84215e34A83',
    MixedRouteQuoterV1: '0x88888a4a1e5c54A21A875BD5676bEc211D902dba',
    SugarHelper: '0x88887E0C9819719897050228F181e992f7a07bd9',
    CustomSwapFeeModule: '0x8888C00889B0Fff1A8D41f29F2F999AF2413fe83',
    CustomUnstakedFeeModule: '0x88888Ff05C141C690319ED7B12D555ec97565389',
    NFTDescriptor: '0x88886Ea0791846EcC1f97121755319A86042Cdc0',
    NFTSVG: '0x888854d60a7CCE9e1aA18B3F1a702B37B06A33C9',
} as const;

// ============================================
// Common Addresses
// ============================================
export const COMMON = {
    // Wrapped ETH (canonical WETH on Base)
    WSEI: '0x4200000000000000000000000000000000000006',
    WETH: '0x4200000000000000000000000000000000000006',

    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
} as const;

// ============================================
// All Contracts Combined (for easy access)
// ============================================
// Notable pools (empty on Base for now)
export const NOTABLE_POOLS = {} as const;
export const NOTABLE_GAUGES = {} as const;

// Stub for LORE mining (Sei-only)
export const LORE_MINING_CONTRACTS = {
    LOREmining: '0x0000000000000000000000000000000000000000',
    BondingCurve: '0x0000000000000000000000000000000000000000',
    LoreToken: '0x0000000000000000000000000000000000000000',
} as const;

export const WIND_CURVE_CONTRACTS = {
    BondingCurve: '0x0000000000000000000000000000000000000000',
    Staking: '0x0000000000000000000000000000000000000000',
    BTBToken: '0x0000000000000000000000000000000000000000',
} as const;

export const BTB_CONTRACTS = {
    BTB: '0x0000000000000000000000000000000000000000',
    BTBB: '0x0000000000000000000000000000000000000000',
    BearNFT: '0x0000000000000000000000000000000000000000',
    BearStaking: '0x0000000000000000000000000000000000000000',
} as const;

export const ALL_CONTRACTS = {
    ...V2_CONTRACTS,
    ...V2_LIBRARIES,
    ...CL_CONTRACTS,
    ...COMMON,
} as const;
