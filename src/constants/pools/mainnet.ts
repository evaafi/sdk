import { Address, Dictionary } from '@ton/core';
import {
    EVAA_JUSDT_PRICE_FEED_ID,
    packConnectedFeeds,
    PYTH_TON_PRICE_FEED_ID,
    PYTH_USDT_PRICE_FEED_ID,
} from '../../api/feeds';
import { DefaultPythPriceSourcesConfig, PricesCollector, PythCollector } from '../../prices';
import { PoolConfig } from '../../types/Master';
import { EvaaRewardsConfig } from '../../types/MasterRewards';
import {
    ASSET_ID,
    CATI_MAINNET,
    DOGS_MAINNET,
    JUSDC_MAINNET,
    JUSDT_MAINNET,
    NOT_MAINNET,
    PT_tsUSDe_01Sep2025_MAINNET,
    STTON_MAINNET,
    TON_MAINNET,
    TON_STORM_MAINNET,
    TONUSDT_DEDUST_MAINNET,
    TONUSDT_STONFI_MAINNET,
    TSTON_MAINNET,
    TSUSDE_MAINNET,
    USDE_MAINNET,
    USDT_MAINNET,
    USDT_STORM_MAINNET,
} from '../assets';
import {
    EVAA_ALTS_MAINNET,
    EVAA_ALTS_MAINNET_VERSION,
    EVAA_LP_MAINNET,
    EVAA_LP_MAINNET_VERSION,
    EVAA_MASTER_MAINNET,
    EVAA_PYTH_TOB_MAINNET,
    EVAA_PYTH_TOB_VERSION,
    EVAA_REWARDS_MASTER_CODE_MAINNET,
    EVAA_REWARDS_USER_CODE_MAINNET,
    EVAA_STABLE_MAINNET,
    EVAA_TOB_MAINNET,
    EVAA_TOB_VERSION,
    EVAA_TON_REWARDS_MASTER_MAINNET,
    EVAA_USDT_REWARDS_MASTER_MAINNET,
    LENDING_CODE,
    MAINNET_VERSION,
    MASTER_CONSTANTS,
    ORACLES_ALTS,
    ORACLES_LP,
    ORACLES_MAINNET,
    PYTH_ORACLE_MAINNET,
    STABLE_VERSION,
} from '../general';

// Pool assets configs
export const MAINNET_POOL_ASSETS_CONFIG = [
    TON_MAINNET,
    JUSDT_MAINNET,
    JUSDC_MAINNET,
    STTON_MAINNET,
    TSTON_MAINNET,
    USDT_MAINNET,
    USDE_MAINNET,
    TSUSDE_MAINNET,
];

const MAINNET_STABLE_POOL_ASSETS_CONFIG = [USDT_MAINNET, USDE_MAINNET, TSUSDE_MAINNET, PT_tsUSDe_01Sep2025_MAINNET];

const MAINNET_LP_POOL_ASSETS_CONFIG = [
    TON_MAINNET,
    USDT_MAINNET,
    TONUSDT_DEDUST_MAINNET,
    TON_STORM_MAINNET,
    USDT_STORM_MAINNET,
    TONUSDT_STONFI_MAINNET,
];

const MAINNET_ALTS_POOL_ASSETS_CONFIG = [TON_MAINNET, USDT_MAINNET, CATI_MAINNET, NOT_MAINNET, DOGS_MAINNET];

export const MAINNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_MAINNET,
    masterVersion: MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_MAINNET,
    }),
    poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const MAINNET_STABLE_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_STABLE_MAINNET,
    masterVersion: STABLE_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_STABLE_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_MAINNET,
    }),
    poolAssetsConfig: MAINNET_STABLE_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const MAINNET_LP_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_LP_MAINNET,
    masterVersion: EVAA_LP_MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_LP_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_LP,
    }),
    poolAssetsConfig: MAINNET_LP_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const MAINNET_ALTS_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_ALTS_MAINNET,
    masterVersion: EVAA_ALTS_MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_ALTS_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_ALTS,
    }),
    poolAssetsConfig: MAINNET_ALTS_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const MAINNET_PYTH_V8_TOB_POOL_ASSETS_CONFIG = [TON_MAINNET, USDT_MAINNET, JUSDT_MAINNET];

export const MAINNET_PYTH_V8_TOB_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_PYTH_TOB_MAINNET,
    masterVersion: EVAA_PYTH_TOB_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PythCollector({
        pythConfig: DefaultPythPriceSourcesConfig,
        poolAssetsConfig: MAINNET_PYTH_V8_TOB_POOL_ASSETS_CONFIG,
        pythOracle: {
            feedsMap: Dictionary.empty<bigint, Buffer>()
                .set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.TON, 0n))
                .set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDT, 0n)),
            pythAddress: PYTH_ORACLE_MAINNET,
            allowedRefTokens: Dictionary.empty<bigint, bigint>().set(
                BigInt(EVAA_JUSDT_PRICE_FEED_ID),
                BigInt(ASSET_ID.USDT),
            ),
        },
    }),
    poolAssetsConfig: MAINNET_PYTH_V8_TOB_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const MAINNET_V8_TOB_POOL_ASSETS_CONFIG = [TON_MAINNET, USDT_MAINNET];

export const MAINNET_V8_TOB_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_TOB_MAINNET,
    masterVersion: EVAA_TOB_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_V8_TOB_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_MAINNET,
    }),
    poolAssetsConfig: MAINNET_V8_TOB_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const MAINNET_MASTER_TON_REWARD_CONFIG: EvaaRewardsConfig = {
    adminAddress: EVAA_TON_REWARDS_MASTER_MAINNET,
    evaaMasterAddress: new Address(0, Buffer.alloc(32, 0)),
    rewardMasterCode: EVAA_REWARDS_MASTER_CODE_MAINNET,
    rewardUserCode: EVAA_REWARDS_USER_CODE_MAINNET,
    asset: TON_MAINNET,
    availableReward: 0,
    publicKey: Buffer.from('bfe9a30221db4dff4c17e55d985e0b13a8f597bbb28002f311dc4429dad1ca95', 'hex'), // adminAddress publicKey
};

export const MAINNET_MASTER_USDT_REWARD_CONFIG: EvaaRewardsConfig = {
    adminAddress: EVAA_USDT_REWARDS_MASTER_MAINNET,
    evaaMasterAddress: new Address(0, Buffer.alloc(32, 0)),
    rewardMasterCode: EVAA_REWARDS_MASTER_CODE_MAINNET,
    rewardUserCode: EVAA_REWARDS_USER_CODE_MAINNET,
    asset: USDT_MAINNET,
    availableReward: 0,
    publicKey: Buffer.from('9813725d6cead1c9bbc0e24b21d4fc62a7fa8ac4bb01b6758df30169a71dba67', 'hex'), // adminAddress publicKey
};

export const ALL_MAINNET_POOLS: PoolConfig[] = [
    MAINNET_POOL_CONFIG,
    MAINNET_LP_POOL_CONFIG,
    MAINNET_ALTS_POOL_CONFIG,
    MAINNET_STABLE_POOL_CONFIG,
];
