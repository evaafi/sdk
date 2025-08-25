import { Address } from '@ton/core';
import { TESTNET_ALLOWED_REF_TOKENS, TESTNET_FEEDS_MAP } from '../../api/feeds';
import { DefaultPythPriceSourcesConfig, PythCollector } from '../../prices';
import { PoolConfig } from '../../types/Master';
import { EvaaRewardsConfig } from '../../types/MasterRewards';
import { EUSDT_TESTNET, JUSDC_TESTNET, TON_TESTNET } from '../assets';
import {
    EVAA_MASTER_TESTNET_TOB_AUDITED,
    EVAA_REWARDS_MASTER_CODE_TESTNET,
    EVAA_REWARDS_MASTER_TESTNET,
    EVAA_REWARDS_USER_CODE_TESTNET,
    LENDING_CODE,
    MASTER_CONSTANTS,
    PYTH_ORACLE_TESTNET,
    TESTNET_VERSION_TOB_AUDITED,
} from '../general';

export const TESTNET_POOL_ASSETS_CONFIG = [TON_TESTNET];

export const TESTNET_POOL_ASSETS_CONFIG_TOB_AUDITED = [TON_TESTNET, JUSDC_TESTNET];

export const TESTNET_POOL_CONFIG_TOB_AUDITED: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET_TOB_AUDITED,
    masterVersion: TESTNET_VERSION_TOB_AUDITED,
    masterConstants: MASTER_CONSTANTS,
    oracles: new PythCollector({
        poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG_TOB_AUDITED,
        pythOracle: {
            feedsMap: TESTNET_FEEDS_MAP,
            pythAddress: PYTH_ORACLE_TESTNET,
            allowedRefTokens: TESTNET_ALLOWED_REF_TOKENS,
        },
        pythConfig: DefaultPythPriceSourcesConfig,
    }),
    poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG_TOB_AUDITED,
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

export const ALL_TESTNET_POOLS: PoolConfig[] = [];
