import { Address } from "@ton/core";
import { JUSDC_MAINNET, JUSDC_TESTNET, JUSDT_MAINNET, JUSDT_TESTNET, STTON_MAINNET, STTON_TESTNET, TON_MAINNET, TON_STORM_MAINNET, TONUSDT_DEDUST_MAINNET, TSTON_MAINNET, USDT_MAINNET, USDT_STORM_MAINNET } from "./assets";
import { PoolConfig } from "../types/Master";
import { EVAA_MASTER_MAINNET, EVAA_MASTER_TESTNET, LENDING_CODE, MAINNET_VERSION, MASTER_CONSTANTS, MAIN_POOL_NFT_ID, TESTNET_VERSION, LP_POOL_NFT_ID, EVAA_LP_TESTNET, EVAA_LP_TESTNET_VERSION, EVAA_LP_MAINNET, EVAA_LP_MAINNET_VERSION } from "./general";

export const MAINNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_MAINNET,
    masterVersion: MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    nftId: MAIN_POOL_NFT_ID,
    poolAssetsConfig: [
        TON_MAINNET,
        JUSDT_MAINNET,
        JUSDC_MAINNET,
        STTON_MAINNET,
        TSTON_MAINNET,
        USDT_MAINNET
    ],
    lendingCode: LENDING_CODE
};

export const TESTNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET,
    masterVersion: TESTNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    nftId: MAIN_POOL_NFT_ID,
    poolAssetsConfig: [
        TON_MAINNET,
        JUSDT_TESTNET,
        JUSDC_TESTNET,
        STTON_TESTNET
    ],
    lendingCode: LENDING_CODE
};

export const TESTNET_LP_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_LP_TESTNET,
    masterVersion: EVAA_LP_TESTNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    nftId: LP_POOL_NFT_ID,
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
    nftId: LP_POOL_NFT_ID,
    poolAssetsConfig: [
        TON_MAINNET,
        USDT_MAINNET,
        TONUSDT_DEDUST_MAINNET,
        TON_STORM_MAINNET,
        USDT_STORM_MAINNET,
    ],
    lendingCode: LENDING_CODE
};
