// Old Wind Swap Contract Addresses - Base (first deployment, before bug-fix redeployment)
// These contracts may still hold user balances that need migration

export const OLD_V2_CONTRACTS = {
    WIND: '0x888859FEaAb4922DFBB9Add836172ec6f38caBb2',
    VotingEscrow: '0x88889e34e5Eb7a8F0f986DDce5f2711220A0c02F',
    Router: '0x88880576315176b632b0D7a4DD291d6b5e317692',
    Voter: '0x888843352588d670F0e0c009Ec276d5F055aE9Ed',
    Minter: '0x88882CEe351fA534C1b2DB2c72A6762F6c80c4BC',
    PoolFactory: '0x88881EF7Fd02FaC4C3321bb9f65Be887008290f0',
    Pool: '0x8888f98b168dA48a0cb5C6Ba20A132Cf1149E579',
    RewardsDistributor: '0x88881105D16f242B791fE8D713C254D3992b2A6E',
    FactoryRegistry: '0x8888500b00C5f5eCCa7BbCD2fFB04619F6b8b4cc',
    GaugeFactory: '0x8888fc8623ca00349e4f947Dd99330F3AF75a941',
    VotingRewardsFactory: '0x888834b351dfE9953Ddac7c427640B0Ff70Fc34D',
    ManagedRewardsFactory: '0x888890188ea6473c0E31AB762140F49D4368B96D',
    VeArtProxy: '0x8888232436766e1b6EEabC37ff7913ee3D90A455',
    AirdropDistributor: '0x88888EE2c6e04586a1DfE15e5e89eD1288149e68',
    Forwarder: '0x888886dDfbb2aDa679c70F03907D1c789b991593',
} as const;

export const OLD_CL_CONTRACTS = {
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

// Old Goldsky subgraph that indexes the old contracts
export const OLD_SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cmjlh2t5mylhg01tm7t545rgk/subgraphs/windswap-base/1.0.6/gn';
