import { CATI_MAINNET, DOGS_MAINNET, JUSDC_MAINNET, JUSDC_TESTNET, JUSDT_MAINNET, JUSDT_TESTNET, NOT_MAINNET, STTON_MAINNET, STTON_TESTNET, TON_MAINNET, TON_STORM_MAINNET, TONUSDT_DEDUST_MAINNET, TSTON_MAINNET, USDT_MAINNET, USDT_STORM_MAINNET, UTON_MAINNET } from "./assets";
import { PoolConfig } from "../types/Master";
import { EVAA_MASTER_MAINNET, EVAA_MASTER_TESTNET, LENDING_CODE, MAINNET_VERSION, MASTER_CONSTANTS, TESTNET_VERSION, EVAA_LP_MAINNET, EVAA_LP_MAINNET_VERSION, ORACLES_MAINNET, ORACLES_LP, ORACLES_TESTNET, EVAA_ALTS_MAINNET, EVAA_ALTS_MAINNET_VERSION, ORACLES_ALTS } from "./general";

export const MAINNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_MAINNET,
    masterVersion: MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: ORACLES_MAINNET,
    minimalOracles: 3,
    poolAssetsConfig: [
        TON_MAINNET,
        JUSDT_MAINNET,
        JUSDC_MAINNET,
        STTON_MAINNET,
        TSTON_MAINNET,
        USDT_MAINNET,
        UTON_MAINNET // announce
    ],
    lendingCode: LENDING_CODE
};

export const TESTNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET,
    masterVersion: TESTNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: ORACLES_TESTNET,
    minimalOracles: 3,
    poolAssetsConfig: [
        TON_MAINNET,
        JUSDT_TESTNET,
        JUSDC_TESTNET,
        STTON_TESTNET
    ],
    lendingCode: LENDING_CODE
};

export const MAINNET_LP_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_LP_MAINNET,
    masterVersion: EVAA_LP_MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: ORACLES_LP,
    minimalOracles: 3,
    poolAssetsConfig: [
        TON_MAINNET,
        USDT_MAINNET,
        TONUSDT_DEDUST_MAINNET,
        TON_STORM_MAINNET,
        USDT_STORM_MAINNET
    ],
    lendingCode: LENDING_CODE
};

export const MAINNET_ALTS_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_ALTS_MAINNET,
    masterVersion: EVAA_ALTS_MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: ORACLES_ALTS,
    minimalOracles: 3,
    poolAssetsConfig: [
        TON_MAINNET,
        USDT_MAINNET,
        CATI_MAINNET,
        NOT_MAINNET,
        DOGS_MAINNET
    ],
    lendingCode: LENDING_CODE
};
