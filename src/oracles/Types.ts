import type { PriceUpdate } from '@pythnetwork/hermes-client';
import type { Cell, Dictionary } from '@ton/core';

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
 * Configuration for pyth prices.
 */

export type PythPriceSourcesConfig = {
    /** Endpoints for pyth price data */
    pythEndpoints: string[];
};

/**
 * Default configuration for price source endpoints.
 */
export const DefaultPriceSourcesConfig: PriceSourcesConfig = {
    backendEndpoints: ['api.evaa.space', 'evaa.space'],
    icpEndpoints: ['6khmc-aiaaa-aaaap-ansfq-cai.raw.icp0.io'],
};

/**
 * Configuration for pyth price sources.
 */
export const DefaultPythPriceSourcesConfig: PythPriceSourcesConfig = {
    // FYI: 3RPS limit per IP, TODO: support Pythnet RPC
    pythEndpoints: ['https://hermes.pyth.network'],
};

export type RawPriceData = {
    dict: Dictionary<bigint, bigint>;
    dataCell: Cell;
    oracleId: number;
    signature: Buffer;
    pubkey: Buffer;
    timestamp: number;
};

export type PythFeedUpdateType = {
    parsed: PriceUpdate['parsed'];
    binary: Buffer;
};

export type OraclePricesData = {
    timestamp: number;
    prices: Dictionary<bigint, bigint>;
};
