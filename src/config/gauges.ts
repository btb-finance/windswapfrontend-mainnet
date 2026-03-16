// Wind Swap Gauge List - Base
// Gauge addresses fetched from Voter contract

export interface GaugeConfig {
    pool: string;
    gauge: string;
    token0: string;
    token1: string;
    symbol0: string;
    symbol1: string;
    type: 'V2' | 'CL';
    tickSpacing?: number;
    isAlive: boolean;
}

// No gauges deployed on Base yet - will be populated after gauge creation
export const GAUGE_LIST: GaugeConfig[] = [];
