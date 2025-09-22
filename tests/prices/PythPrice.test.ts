import { Dictionary } from '@ton/core';
import {
    ASSET_ID,
    DefaultPythPriceSourcesConfig,
    FetchConfig,
    JUSDC_MAINNET,
    JUSDT_MAINNET,
    packConnectedFeeds,
    PYTH_ORACLE_MAINNET,
    PYTH_TON_PRICE_FEED_ID,
    PYTH_TSTON_PRICE_FEED_ID,
    PYTH_TSUSDE_PRICE_FEED_ID,
    PYTH_USDT_PRICE_FEED_ID,
    PythCollector,
    STTON_MAINNET,
    TON_MAINNET,
    TSTON_MAINNET,
    TSUSDE_MAINNET,
    UNDEFINED_ASSET,
    USDE_MAINNET,
    USDT_MAINNET,
} from '../../src';

describe('PythOracle LSD assets', () => {
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
        (oracle = new PythCollector({
            pythConfig: DefaultPythPriceSourcesConfig,
            poolAssetsConfig,
            pythOracle: {
                feedsMap: Dictionary.empty<bigint, Buffer>()
                    .set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.TON, 0n))
                    .set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDT, 0n))
                    .set(
                        BigInt(PYTH_TSTON_PRICE_FEED_ID),
                        packConnectedFeeds(ASSET_ID.tsTON, BigInt(PYTH_TON_PRICE_FEED_ID)),
                    )
                    .set(
                        BigInt(PYTH_TSUSDE_PRICE_FEED_ID),
                        packConnectedFeeds(ASSET_ID.tsUSDe, BigInt(PYTH_USDT_PRICE_FEED_ID)),
                    ),
                pythAddress: PYTH_ORACLE_MAINNET,
                allowedRefTokens: Dictionary.empty<bigint, bigint>()
                    .set(ASSET_ID.jUSDT, ASSET_ID.USDT)
                    .set(ASSET_ID.jUSDC, ASSET_ID.USDT)
                    .set(ASSET_ID.USDe, ASSET_ID.USDT)
                    .set(ASSET_ID.stTON, ASSET_ID.tsTON),
            },
        })),
            (fetchConfig = {
                retries: 3,
                timeout: 1000,
            });
    });

    describe('createRequiredFeedsList', () => {
        it('should return direct Pyth feeds for assets with native feeds', () => {
            // Test TON asset - has direct feed
            const tonFeeds = oracle.createRequiredFeedsList([TON_MAINNET]);
            expect(tonFeeds).toHaveLength(1);
            expect(tonFeeds).toContain(PYTH_TON_PRICE_FEED_ID);

            // Test USDT asset - has direct feed
            const usdtFeeds = oracle.createRequiredFeedsList([USDT_MAINNET]);
            expect(usdtFeeds).toHaveLength(1);
            expect(usdtFeeds).toContain(PYTH_USDT_PRICE_FEED_ID);
        });

        it('should return feeds for assets using reference tokens', () => {
            // Test jUSDT -> USDT reference
            const jUsdtFeeds = oracle.createRequiredFeedsList([JUSDT_MAINNET]);
            expect(jUsdtFeeds).toHaveLength(1);
            expect(jUsdtFeeds).toContain(PYTH_USDT_PRICE_FEED_ID);

            // Test jUSDC -> USDT reference
            const jUsdcFeeds = oracle.createRequiredFeedsList([JUSDC_MAINNET]);
            expect(jUsdcFeeds).toHaveLength(1);
            expect(jUsdcFeeds).toContain(PYTH_USDT_PRICE_FEED_ID);

            // Test USDe -> USDT reference
            const usdeFeeds = oracle.createRequiredFeedsList([USDE_MAINNET]);
            expect(usdeFeeds).toHaveLength(1);
            expect(usdeFeeds).toContain(PYTH_USDT_PRICE_FEED_ID);

            // Test stTON -> tsTON reference
            const stTonFeeds = oracle.createRequiredFeedsList([STTON_MAINNET]);
            expect(stTonFeeds).toHaveLength(2); // tsTON feed + its connected TON feed
            expect(stTonFeeds).toContain(PYTH_TSTON_PRICE_FEED_ID);
            expect(stTonFeeds).toContain(PYTH_TON_PRICE_FEED_ID);
        });

        it('should return connected feeds for assets with referred feeds', () => {
            // Test tsTON - has connected feed to TON
            const tsTonFeeds = oracle.createRequiredFeedsList([TSTON_MAINNET]);
            expect(tsTonFeeds).toHaveLength(2);
            expect(tsTonFeeds).toContain(PYTH_TSTON_PRICE_FEED_ID);
            expect(tsTonFeeds).toContain(PYTH_TON_PRICE_FEED_ID);

            // Test tsUSDe - has connected feed to USDT
            const tsUsdeFeeds = oracle.createRequiredFeedsList([TSUSDE_MAINNET]);
            expect(tsUsdeFeeds).toHaveLength(2);
            expect(tsUsdeFeeds).toContain(PYTH_TSUSDE_PRICE_FEED_ID);
            expect(tsUsdeFeeds).toContain(PYTH_USDT_PRICE_FEED_ID);
        });

        it('should handle multiple assets and deduplicate feeds', () => {
            // Test multiple assets that share feeds
            const multipleFeeds = oracle.createRequiredFeedsList([
                JUSDT_MAINNET,
                JUSDC_MAINNET,
                USDE_MAINNET,
                USDT_MAINNET,
            ]);

            // All these assets should resolve to USDT feed, so only one unique feed
            expect(multipleFeeds).toHaveLength(1);
            expect(multipleFeeds).toContain(PYTH_USDT_PRICE_FEED_ID);

            // Test assets with different feeds
            const diverseFeeds = oracle.createRequiredFeedsList([TON_MAINNET, USDT_MAINNET, TSTON_MAINNET]);

            // Should have TON, USDT, tsTON feeds (tsTON also needs TON, but it's deduplicated)
            expect(diverseFeeds).toHaveLength(3);
            expect(diverseFeeds).toContain(PYTH_TON_PRICE_FEED_ID);
            expect(diverseFeeds).toContain(PYTH_USDT_PRICE_FEED_ID);
            expect(diverseFeeds).toContain(PYTH_TSTON_PRICE_FEED_ID);
        });

        it('should handle edge cases', () => {
            // Test empty array
            const emptyFeeds = oracle.createRequiredFeedsList([]);
            expect(emptyFeeds).toHaveLength(0);

            // Test non-existent asset ID (should return empty since no feed mapping exists)
            const nonExistentFeeds = oracle.createRequiredFeedsList([UNDEFINED_ASSET]);
            expect(nonExistentFeeds).toHaveLength(0);
        });

        it('should return properly formatted hex strings', () => {
            const feeds = oracle.createRequiredFeedsList([TON_MAINNET]);

            expect(feeds).toHaveLength(1);
            expect(feeds[0]).toMatch(/^0x[0-9a-f]+$/i); // Should be hex string starting with 0x
            expect(feeds[0]).toBe(PYTH_TON_PRICE_FEED_ID);
        });

        it('should handle complex scenario with reference tokens and connected feeds', () => {
            // Test stTON which goes: stTON -> tsTON (via allowedRefTokens) -> TON (via connected feed)
            const stTonFeeds = oracle.createRequiredFeedsList([STTON_MAINNET]);

            expect(stTonFeeds).toHaveLength(2);
            expect(stTonFeeds).toContain(PYTH_TSTON_PRICE_FEED_ID); // tsTON feed
            expect(stTonFeeds).toContain(PYTH_TON_PRICE_FEED_ID); // Connected TON feed
        });
    });
});
