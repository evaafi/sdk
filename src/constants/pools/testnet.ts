import type { HexString } from '@pythnetwork/hermes-client';
import type { PoolConfig } from '../../types/Master';
import type { EvaaRewardsConfig } from '../../types/MasterRewards';
import { Address, Dictionary } from '@ton/core';
import { FEED_ID, type FeedMapItem } from '../../api/feeds';
import { ClassicCollector, DefaultPythPriceSourcesConfig, PythCollector } from '../../oracles';
import {
    ASSET_ID,
    EUSDT_TESTNET,
    JUSDC_TESTNET,
    TON_MAINNET,
    TON_TESTNET,
    TSTON_MAINNET,
    USDE_MAINNET,
    USDT_MAINNET,
} from '../assets';
import {
    EVAA_MASTER_TESTNET_CLASSIC_TOB_AUDITED,
    EVAA_MASTER_TESTNET_PYTH_TOB_AUDITED,
    EVAA_REWARDS_MASTER_CODE_TESTNET,
    EVAA_REWARDS_MASTER_TESTNET,
    EVAA_REWARDS_USER_CODE_TESTNET,
    LENDING_CODE,
    MASTER_CONSTANTS,
    ORACLES_TESTNET,
    PYTH_ORACLE_TESTNET,
    TESTNET_CLASSIC_TOB_AUDITED,
    TESTNET_PYTH_VERSION_TOB_AUDITED,
} from '../general';

export const TESTNET_POOL_ASSETS_CONFIG = [TON_TESTNET, JUSDC_TESTNET];

export const TESTNET_POOL_ASSETS_CONFIG_TOB_AUDITED = [TON_TESTNET, JUSDC_TESTNET];

export const TESTNET_PYTH_POOL_CONFIG_TOB_AUDITED: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET_PYTH_TOB_AUDITED,
    masterVersion: TESTNET_PYTH_VERSION_TOB_AUDITED,
    masterConstants: MASTER_CONSTANTS,
    collector: new PythCollector({
        poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG_TOB_AUDITED,
        pythOracle: {
            feedsMap: new Map<HexString, FeedMapItem>([
                [
                    FEED_ID.TON,
                    {
                        assetId: ASSET_ID.TON,
                        feedId: '0x0',
                    },
                ],
            ]),
            pythAddress: PYTH_ORACLE_TESTNET,
            allowedRefTokens: Dictionary.empty<bigint, bigint>().set(ASSET_ID.jUSDT, ASSET_ID.USDT),
        },
        pythConfig: DefaultPythPriceSourcesConfig,
    }),
    poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG_TOB_AUDITED,
    poolAssetsHEConfig: [],
    lendingCode: LENDING_CODE,
};

export const TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED: PoolConfig = {
    masterAddress: EVAA_MASTER_TESTNET_CLASSIC_TOB_AUDITED,
    masterVersion: TESTNET_CLASSIC_TOB_AUDITED,
    masterConstants: MASTER_CONSTANTS,
    collector: new ClassicCollector({
        poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG,
        minimalOracles: 3,
        evaaOracles: ORACLES_TESTNET,
    }),
    lendingCode: LENDING_CODE,
    poolAssetsConfig: TESTNET_POOL_ASSETS_CONFIG,
    poolAssetsHEConfig: [],
};

export const TESTNET_CLASSIC_HE_POOL_CONFIG: PoolConfig = {
    masterAddress: Address.parse('EQBykKj3k97Mx_EEGwzmnqFLteFRAt0BIg-ig96ifNkdV3Wn'),
    masterVersion: 0,
    masterConstants: MASTER_CONSTANTS,
    collector: new ClassicCollector({
        poolAssetsConfig: [TON_MAINNET, TSTON_MAINNET, USDT_MAINNET, USDE_MAINNET],
        minimalOracles: 1,
        evaaOracles: ORACLES_TESTNET,
    }),
    lendingCode: LENDING_CODE,
    poolAssetsConfig: [TON_MAINNET, TSTON_MAINNET, USDT_MAINNET, USDE_MAINNET],
    poolAssetsHEConfig: [],
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
