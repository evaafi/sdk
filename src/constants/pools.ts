import { Address } from '@ton/core'
import { TESTNET_ALLOWED_REF_TOKENS, TESTNET_FEEDS_MAP } from '../api/feeds'
import { DefaultPythPriceSourcesConfig, PricesCollector, PythCollector } from '../prices'
import { PoolConfig } from '../types/Master'
import { EvaaRewardsConfig } from '../types/MasterRewards'
import {
    CATI_MAINNET,
    DOGS_MAINNET,
    EUSDT_TESTNET,
    JUSDC_MAINNET,
    JUSDC_TESTNET,
    JUSDT_MAINNET,
    NOT_MAINNET,
    PT_tsUSDe_01Sep2025_MAINNET,
    STTON_MAINNET,
    TON_MAINNET,
    TON_STORM_MAINNET,
    TON_TESTNET,
    TONUSDT_DEDUST_MAINNET,
    TSTON_MAINNET,
    TSUSDE_MAINNET,
    USDE_MAINNET,
    USDT_MAINNET,
    USDT_STORM_MAINNET
} from './assets'
import {
    EVAA_ALTS_MAINNET,
    EVAA_ALTS_MAINNET_VERSION,
    EVAA_ETHENA_MAINNET,
    EVAA_ETHENA_VERSION,
    EVAA_LP_MAINNET,
    EVAA_LP_MAINNET_VERSION,
    EVAA_MASTER_MAINNET,
    EVAA_MASTER_TESTNET,
    EVAA_MASTER_TESTNET_V7,
    EVAA_REWARDS_MASTER_CODE_MAINNET,
    EVAA_REWARDS_MASTER_CODE_TESTNET,
    EVAA_REWARDS_MASTER_TESTNET,
    EVAA_REWARDS_USER_CODE_MAINNET,
    EVAA_REWARDS_USER_CODE_TESTNET,
    EVAA_STABLE_MAINNET,
    EVAA_TON_REWARDS_MASTER_MAINNET,
    EVAA_USDT_REWARDS_MASTER_MAINNET,
    LENDING_CODE,
    MAINNET_VERSION,
    MASTER_CONSTANTS,
    ORACLES_ALTS,
    ORACLES_LP,
    ORACLES_MAINNET,
    ORACLES_TESTNET,
    PYTH_ORACLE_TESTNET,
    STABLE_VERSION,
    TESTNET_VERSION,
    TESTNET_VERSION_V7
} from './general'

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
    // UTON_MAINNET // announce xdddd fake announce 
];

const MAINNET_STABLE_POOL_ASSETS_CONFIG = [
    USDT_MAINNET,
    USDE_MAINNET,
    TSUSDE_MAINNET,
    PT_tsUSDe_01Sep2025_MAINNET
];

const MAINNET_TEST_ETHENA_POOL_ASSETS_CONFIG = [
    TON_MAINNET,
    USDE_MAINNET,
];

const TESTNET_POOL_ASSETS_CONFIG = [
    TON_MAINNET,
    EUSDT_TESTNET,
    // JUSDC_TESTNET, // если нужен, добавить
    // STTON_TESTNET // если нужен, добавить
];

export const TESTNET_POOL_ASSETS_CONFIG_V7 = [TON_TESTNET, JUSDC_TESTNET, USDT_MAINNET];

const MAINNET_LP_POOL_ASSETS_CONFIG = [
    TON_MAINNET, USDT_MAINNET, TONUSDT_DEDUST_MAINNET, TON_STORM_MAINNET, USDT_STORM_MAINNET
];

const MAINNET_ALTS_POOL_ASSETS_CONFIG = [
    TON_MAINNET, USDT_MAINNET, CATI_MAINNET, NOT_MAINNET, DOGS_MAINNET
];

export const MAINNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_MAINNET,
    masterVersion: MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_MAINNET
    }),
    poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const TESTNET_V7_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET_V7,
    masterVersion: TESTNET_VERSION_V7,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PythCollector({
        poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG_V7,
        pythOracle: {
            feedsMap: TESTNET_FEEDS_MAP,
            pythAddress: PYTH_ORACLE_TESTNET,
            allowedRefTokens: TESTNET_ALLOWED_REF_TOKENS,
        },
        pythConfig: DefaultPythPriceSourcesConfig,
    }),
    poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG_V7,
    lendingCode: LENDING_CODE,
};

export const MAINNET_STABLE_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_STABLE_MAINNET,
    masterVersion: STABLE_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_STABLE_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_MAINNET
    }),
    poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG_V7,
    lendingCode: LENDING_CODE,
};

export const MAINNET_TEST_ETHENA_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_ETHENA_MAINNET,
    masterVersion: EVAA_ETHENA_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_TEST_ETHENA_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_MAINNET
    }),
    poolAssetsConfig: MAINNET_TEST_ETHENA_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const TESTNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET,
    masterVersion: TESTNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_TESTNET
    }),
    poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE
};

export const MAINNET_LP_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_LP_MAINNET,
    masterVersion: EVAA_LP_MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PricesCollector({
        poolAssetsConfig: MAINNET_LP_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_LP
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
        evaaOracles: ORACLES_ALTS
    }),
    poolAssetsConfig: MAINNET_ALTS_POOL_ASSETS_CONFIG,
    lendingCode: LENDING_CODE,
};

export const TESTNET_MASTER_REWARD_CONFIG: EvaaRewardsConfig = {
    adminAddress: EVAA_REWARDS_MASTER_TESTNET,
    evaaMasterAddress: new Address(0, Buffer.alloc(32, 0)),
    rewardMasterCode: EVAA_REWARDS_MASTER_CODE_TESTNET,
    rewardUserCode: EVAA_REWARDS_USER_CODE_TESTNET,
    asset: TON_TESTNET,
    availableReward: 0,
    publicKey: Buffer.from('c38be45e033419b49cd22c97fbd23610fbc851a931208f8b4a1817dd11cb63ac', 'hex'), // adminAddress publicKey
};

export const TESTNET_MASTER_EUSDT_REWARD_CONFIG: EvaaRewardsConfig = {
    adminAddress: EVAA_REWARDS_MASTER_TESTNET,
    evaaMasterAddress: new Address(0, Buffer.alloc(32, 0)),
    rewardMasterCode: EVAA_REWARDS_MASTER_CODE_TESTNET,
    rewardUserCode: EVAA_REWARDS_USER_CODE_TESTNET,
    asset: EUSDT_TESTNET,
    availableReward: 0,
    publicKey: Buffer.from('c38be45e033419b49cd22c97fbd23610fbc851a931208f8b4a1817dd11cb63ac', 'hex'), // adminAddress publicKey
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
