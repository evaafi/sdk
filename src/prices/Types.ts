import { Cell, Dictionary } from '@ton/core';

/**
 * Configuration for price source endpoints.
 */
export type PriceSourcesConfig = {
    /** Endpoints for backend price data */
    backendEndpoints: string[];
    
    /** Endpoints for ICP price data */
    icpEndpoints: string[];
};

/**
 * Default configuration for price source endpoints.
 */
export const DefaultPriceSourcesConfig: PriceSourcesConfig = {
    backendEndpoints: ['api.evaa.space', 'evaa.space'],
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
