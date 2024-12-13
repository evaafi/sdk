import { Cell, Dictionary } from '@ton/core';

/**
 * Configuration for price source endpoints.
 */
export type PriceSourcesConfig = {
    /** Endpoints for backend price data */
    backendEndpoints: string[];
    
    /** Endpoints for IOTA price data */
    iotaEndpoints: string[];
    
    /** Endpoints for ICP price data */
    icpEndpoints: string[];
};

/**
 * Default configuration for price source endpoints.
 */
export const DefaultPriceSourcesConfig: PriceSourcesConfig = {
    backendEndpoints: ['evaa.space'],
    iotaEndpoints: ['api.stardust-mainnet.iotaledger.net'],
    icpEndpoints: ['6khmc-aiaaa-aaaap-ansfq-cai.raw.icp0.io'],
}

export type RawPriceData = {
    dict: Dictionary<bigint, bigint>;
    dataCell: Cell;
    oracleId: number;
    signature: Buffer;
    pubkey: Buffer;
    timestamp: number;
};


export type PriceData = {
    dict: Dictionary<bigint, bigint>;
    dataCell: Cell;
};

export type OraclePricesData = {
    timestamp: number, 
    prices: Dictionary<bigint, bigint>
}
