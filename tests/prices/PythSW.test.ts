import { HexString } from '@pythnetwork/hermes-client';
import { Dictionary } from '@ton/core';
import {
    ASSET_ID,
    DefaultPythPriceSourcesConfig,
    FEED_ID,
    FeedMapItem,
    FetchConfig,
    JUSDC_MAINNET,
    JUSDT_MAINNET,
    PYTH_ORACLE_MAINNET,
    PythCollector,
    STTON_MAINNET,
    TON_MAINNET,
    TSTON_MAINNET,
    TSUSDE_MAINNET,
    USDE_MAINNET,
    USDT_MAINNET,
} from '../../src';

describe('PythOracle User SW', () => {
    let oracle: PythCollector;
    let fetchConfig: FetchConfig;
    let poolAssetsConfig = [
        TON_MAINNET,
        JUSDT_MAINNET,
        JUSDC_MAINNET,
        STTON_MAINNET,
        TSTON_MAINNET,
        USDT_MAINNET,
        USDE_MAINNET,
        TSUSDE_MAINNET,
    ];

    beforeEach(() => {
        oracle = new PythCollector({
            pythConfig: DefaultPythPriceSourcesConfig,
            poolAssetsConfig,
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
        });
        fetchConfig = {
            retries: 3,
            timeout: 1000,
        };
    });

    // TODO
});
