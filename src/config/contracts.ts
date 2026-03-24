// Wind Swap Contract Addresses - Base
// V2 deployed via windv2, V3/CL via windv3swap (CreateX CREATE3)

// ============================================
// V2 Core Contracts (new deployment - bug fixes)
// ============================================
export const V2_CONTRACTS = {
    // Protocol Token (WIND)
    WIND: '0x888a4F89aF7dD0Be836cA367C9FF5490c0F6e888',
    YAKA: '0x888a4F89aF7dD0Be836cA367C9FF5490c0F6e888', // Legacy alias

    // Core Voting Escrow
    VotingEscrow: '0x88889C4Be508cA88eba6ad802340C0563891D426',

    // Router for V2 swaps and liquidity
    Router: '0x88883154C9F8eb3bd34fb760bda1EB7556a20e14',

    // Voter for gauge voting
    Voter: '0x88881EB4b5dD3461fC0CFBc44606E3b401197E38',

    // Token minter
    Minter: '0x8888a8585d2Ab886800409fF97Ce84564CbFeF47',

    // V2 Pool Factory
    PoolFactory: '0x88880e3dA8676C879c3D019EDE0b5a74586813be',

    // Pool implementation
    Pool: '0x888846064b562b1d41F0CbA3B55e28699B1F6d86',

    // Rewards distributor for veNFT rebases
    RewardsDistributor: '0x8888f1e8908F7B268439289091b3Fd1dE2B4c124',

    // Factory registry
    FactoryRegistry: '0x8888220B5E60586D09bc1D0738d964B3c73b3AC1',

    // Gauge Factory
    GaugeFactory: '0x88886e546d9024C53Cfb0FbD87DE83FA9BF9e857',

    // Voting Rewards Factory
    VotingRewardsFactory: '0x8888Cc3Dc53BDdA5F8E97E10d9d2bD881662BA31',

    // Managed Rewards Factory
    ManagedRewardsFactory: '0x8888f67c3A3d7F1F1F4B5440184c3D26e3eD4143',

    // VeArt Proxy for NFT art
    VeArtProxy: '0x888855bf9D1C6e575Ec0e7916D848E225D51BAe9',

    // Airdrop Distributor
    AirdropDistributor: '0x8888d1016C41c6Fe72F968939B02F055284b200e',

    // Forwarder
    Forwarder: '0x888823B4514D65c035f4528255d0e514C2A57b98',

    // StablecoinZap (stub)
    StablecoinZap: '0x0000000000000000000000000000000000000000',

    // Governance (stubs)
    ProtocolGovernor: '0x0000000000000000000000000000000000000000',
    EpochGovernor: '0x0000000000000000000000000000000000000000',
} as const;

// ============================================
// V2 Libraries (new deployment)
// ============================================
export const V2_LIBRARIES = {
    BalanceLogicLibrary: '0x8888957497A69F02004aB78834279E37e66D790A',
    DelegationLogicLibrary: '0x88885ce56AD5836629466AD0429c386a47676FD8',
} as const;

// ============================================
// Slipstream (Concentrated Liquidity) Contracts (new deployment)
// ============================================
export const CL_CONTRACTS = {
    CLFactory: '0x8888A3D87EF6aBC5F50572661E4729A45b255cF6',
    CLPool: '0x8888125154253b50bE0958EDE6648524f92DcEBe',
    CLGaugeFactory: '0x8888B7b5731EBB4E7962cC20b186C92C94bCAFbd',
    CLGauge: '0x88889Dc37A0829d2c5f0F59363ba1De6b6E4E7c8',
    SwapRouter: '0x8888EEA5C97AF36f764259557d2D4CA23e6b19Ff',
    NonfungiblePositionManager: '0x8888bB79b80e6B48014493819656Ffc1444d7687',
    NonfungibleTokenPositionDescriptor: '0x8888e88A64CF0404b523944f8cf7182947D4261d',
    QuoterV2: '0x888831E6a70C71009765bAa1C3d86031539d6B15',
    MixedRouteQuoterV1: '0x88884631783f44261ba37da9a37ffa65dcB1A676',
    SugarHelper: '0x8888F211bC93753a9287f64bdD45a7184C1766Ad',
    CustomSwapFeeModule: '0x8888397cA7c951f700CAFc2E8B657761B92D2aDe',
    CustomUnstakedFeeModule: '0x88889731C6faDb268e0BB34d9f104B54e6d32154',
    NFTDescriptor: '0x88881883ff4d81C6E72978673104934D0852a44a',
    NFTSVG: '0x8888719B0870570DAaCc37473c2290635F37D5E9',
    TickLens: '0x8888C63496a29A46c8E005983886D2552d4c3D03',
    CLInterfaceMulticall: '0x8888Ce7DE18b513DBe6935E0C82aAaE08ADc6127',
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
