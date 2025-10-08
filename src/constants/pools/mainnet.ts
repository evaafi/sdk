import { HexString } from '@pythnetwork/hermes-client';
import { Address, Dictionary } from '@ton/core';
import { FEED_ID, FeedMapItem } from '../../api/feeds';
import { ClassicCollector, DefaultPythPriceSourcesConfig, PythCollector } from '../../oracles';
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
    PT_tsUSDe_18Dec2025_MAINNET,
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

export const MAINNET_STABLE_POOL_ASSETS_CONFIG = [
    USDT_MAINNET,
    USDE_MAINNET,
    TSUSDE_MAINNET,
    PT_tsUSDe_01Sep2025_MAINNET,
    PT_tsUSDe_18Dec2025_MAINNET,
];

export const MAINNET_LP_POOL_ASSETS_CONFIG = [
    TON_MAINNET,
    USDT_MAINNET,
    TONUSDT_DEDUST_MAINNET,
    TON_STORM_MAINNET,
    USDT_STORM_MAINNET,
    TONUSDT_STONFI_MAINNET,
];

export const MAINNET_ALTS_POOL_ASSETS_CONFIG = [TON_MAINNET, USDT_MAINNET, CATI_MAINNET, NOT_MAINNET, DOGS_MAINNET];

export const MAINNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_MAINNET,
    masterVersion: MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    collector: new PythCollector({
        pythConfig: DefaultPythPriceSourcesConfig,
        poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
        pythOracle: {
            feedsMap: new Map<HexString, FeedMapItem>([
                [FEED_ID.TON, { assetId: ASSET_ID.TON, feedId: '0x0' }],
                [FEED_ID.USDT, { assetId: ASSET_ID.USDT, feedId: '0x0' }],
                [FEED_ID.tsTON, { assetId: ASSET_ID.tsTON, feedId: FEED_ID.TON }],
                [FEED_ID.tsUSDe, { assetId: ASSET_ID.tsUSDe, feedId: FEED_ID.USDT }],
            ]),
            pythAddress: PYTH_ORACLE_MAINNET,
            allowedRefTokens: Dictionary.empty<bigint, bigint>()
                .set(ASSET_ID.jUSDT, ASSET_ID.USDT)
                .set(ASSET_ID.jUSDC, ASSET_ID.USDT)
                .set(ASSET_ID.USDe, ASSET_ID.USDT)
                .set(ASSET_ID.stTON, ASSET_ID.tsTON),
        },
    }),
    poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const MAINNET_STABLE_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_STABLE_MAINNET,
    masterVersion: STABLE_VERSION,
    masterConstants: MASTER_CONSTANTS,
    collector: new ClassicCollector({
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
    collector: new ClassicCollector({
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
    collector: new ClassicCollector({
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
    collector: new PythCollector({
        pythConfig: DefaultPythPriceSourcesConfig,
        poolAssetsConfig: MAINNET_PYTH_V8_TOB_POOL_ASSETS_CONFIG,
        pythOracle: {
            feedsMap: new Map<HexString, FeedMapItem>([
                [FEED_ID.TON, { assetId: ASSET_ID.TON, feedId: '0x0' }],
                [FEED_ID.USDT, { assetId: ASSET_ID.USDT, feedId: '0x0' }],
            ]),
            pythAddress: PYTH_ORACLE_MAINNET,
            allowedRefTokens: Dictionary.empty<bigint, bigint>().set(ASSET_ID.jUSDT, ASSET_ID.USDT),
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
    collector: new ClassicCollector({
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
