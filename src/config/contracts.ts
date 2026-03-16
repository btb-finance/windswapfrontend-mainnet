// Wind Swap Contract Addresses - Ethereum Mainnet
// All contracts deployed via CreateX CREATE3 with vanity addresses

// ============================================
// V2 Core Contracts
// ============================================
export const V2_CONTRACTS = {
    // Protocol Token (WIND)
    WIND: '0x888809BfEF45Df38007b3DFfd24E1f5343EcDc7b',
    YAKA: '0x888809BfEF45Df38007b3DFfd24E1f5343EcDc7b', // Legacy alias

    // Core Voting Escrow
    VotingEscrow: '0x88885eA48B68CAEEBffF4Ee6c01b38af8FA62f71',

    // Router for V2 swaps and liquidity
    Router: '0x8888af3f769aD60F6fECEB9664FA7adbBa2c3812',

    // Voter for gauge voting
    Voter: '0x88884cBF344EE63aC013625654Bbbb017502fDfe',

    // Token minter
    Minter: '0x8888259F6EdF107193e0f0dB67c2a914f03cB1CD',

    // V2 Pool Factory
    PoolFactory: '0x8888E2e4380332c4E987eB99aA18355eD879b19B',

    // Pool implementation
    Pool: '0x8888e0Ebb6AB33a3690B4205976A5cB4C924975E',

    // Rewards distributor for veNFT rebases
    RewardsDistributor: '0x8888F24e41f31879a6a4E46E7a40Beb3EB980939',

    // Factory registry
    FactoryRegistry: '0x8888Fdcb6b76bfA338a374702739335dAe05886D',

    // Gauge Factory
    GaugeFactory: '0x88882A74463435C110724E6492d26dfb4C72AF08',

    // Voting Rewards Factory
    VotingRewardsFactory: '0x888863d71e9d42bc6326eA7A73FB790d3c09EBE6',

    // Managed Rewards Factory
    ManagedRewardsFactory: '0x8888Ee5087912172451302cFa70180D21027f38D',

    // VeArt Proxy for NFT art
    VeArtProxy: '0x8888c93968419a7a4cAAbb86016aB2E9774dd00e',

    // Airdrop Distributor
    AirdropDistributor: '0x888865edcCcc3F43Eb82125Ce1AD7938F93ed48f',

    // Forwarder
    Forwarder: '0x8888cC4D6B6D1a83932a923A489016c8e2D6C284',

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
    PerlinNoise: '0x88888AC7d77f5cFe1ac7F9d7bc304e900ad9B60d',
    Trig: '0x888859FEaAb4922DFBB9Add836172ec6f38caBb2',
    BalanceLogicLibrary: '0x88881F00EeE69f1cD6B1a148C0474d467904cC1F',
    DelegationLogicLibrary: '0x88881EF7Fd02FaC4C3321bb9f65Be887008290f0',
} as const;

// ============================================
// Slipstream (Concentrated Liquidity) Contracts
// ============================================
export const CL_CONTRACTS = {
    CLFactory: '0x8888fc8623ca00349e4f947Dd99330F3AF75a941',
    CLPool: '0x8888Fc9Fb892352eD249D94F975663AaA042C214',
    CLGaugeFactory: '0x888834b351dfE9953Ddac7c427640B0Ff70Fc34D',
    CLGauge: '0x8888899B459Dc9E9Fb372E2b05D371dD45D47Ab6',
    SwapRouter: '0x88881C1BC7A0c391C7dA3eD0c6bEa6231F1bAd97',
    NonfungiblePositionManager: '0x888890188ea6473c0E31AB762140F49D4368B96D',
    NonfungibleTokenPositionDescriptor: '0x88888A6DE67Bae32929b42A3062f5c665Dea4fb8',
    QuoterV2: '0x88889e34e5Eb7a8F0f986DDce5f2711220A0c02F',
    MixedRouteQuoterV1: '0x88883a730fEF2A26707E79f4a9fB0D3c821D866a',
    SugarHelper: '0x8888232436766e1b6EEabC37ff7913ee3D90A455',
    CustomSwapFeeModule: '0x8888d548Aa52c0b15F2eb3A20e751BF1A20eBa6B',
    CustomUnstakedFeeModule: '0x8888500b00C5f5eCCa7BbCD2fFB04619F6b8b4cc',
    NFTDescriptor: '0x88881105D16f242B791fE8D713C254D3992b2A6E',
    NFTSVG: '0x8888C087d091b46646523Cae173f14C1BB5e7ECd',
} as const;

// ============================================
// Common Addresses
// ============================================
export const COMMON = {
    // Wrapped ETH (canonical WETH on Ethereum mainnet)
    WSEI: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
} as const;

// ============================================
// All Contracts Combined (for easy access)
// ============================================
// Notable pools (empty on ETH mainnet for now)
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
