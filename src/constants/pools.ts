import { Address } from '@ton/core';
import { PoolConfig } from '../types/Master';
import { EvaaRewardsConfig } from '../types/MasterRewards';
import {
    CATI_MAINNET,
    DOGS_MAINNET,
    EUSDT_TESTNET,
    JUSDC_MAINNET,
    JUSDT_MAINNET,
    NOT_MAINNET,
    STTON_MAINNET,
    TGBTC_TESTNET,
    TON_MAINNET,
    TON_STORM_MAINNET,
    TON_TESTNET,
    TONUSDT_DEDUST_MAINNET,
    TSTON_MAINNET,
    USDT_MAINNET,
    USDT_STORM_MAINNET,
} from './assets';
import {
    EVAA_ALTS_MAINNET,
    EVAA_ALTS_MAINNET_VERSION,
    EVAA_LP_MAINNET,
    EVAA_LP_MAINNET_VERSION,
    EVAA_MASTER_MAINNET,
    EVAA_MASTER_TESTNET,
    EVAA_REWARDS_MASTER_CODE_MAINNET,
    EVAA_REWARDS_MASTER_CODE_TESTNET,
    EVAA_REWARDS_MASTER_TESTNET,
    EVAA_REWARDS_USER_CODE_MAINNET,
    EVAA_REWARDS_USER_CODE_TESTNET,
    EVAA_TON_REWARDS_MASTER_MAINNET,
    EVAA_USDT_REWARDS_MASTER_MAINNET,
    LENDING_CODE,
    MAINNET_VERSION,
    MASTER_CONSTANTS,
    ORACLES_ALTS,
    ORACLES_LP,
    ORACLES_MAINNET,
    ORACLES_TESTNET,
    TESTNET_VERSION,
} from './general';

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
        // UTON_MAINNET // announce
    ],
    lendingCode: LENDING_CODE,
};

export const TESTNET_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET,
    masterVersion: TESTNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: ORACLES_TESTNET,
    minimalOracles: 3,
    poolAssetsConfig: [TON_TESTNET, TGBTC_TESTNET],
    lendingCode: LENDING_CODE,
};

export const MAINNET_LP_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_LP_MAINNET,
    masterVersion: EVAA_LP_MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: ORACLES_LP,
    minimalOracles: 3,
    poolAssetsConfig: [TON_MAINNET, USDT_MAINNET, TONUSDT_DEDUST_MAINNET, TON_STORM_MAINNET, USDT_STORM_MAINNET],
    lendingCode: LENDING_CODE,
};

export const MAINNET_ALTS_POOL_CONFIG: PoolConfig = {
    masterAddress: EVAA_ALTS_MAINNET,
    masterVersion: EVAA_ALTS_MAINNET_VERSION,
    masterConstants: MASTER_CONSTANTS,
    oracles: ORACLES_ALTS,
    minimalOracles: 3,
    poolAssetsConfig: [TON_MAINNET, USDT_MAINNET, CATI_MAINNET, NOT_MAINNET, DOGS_MAINNET],
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
