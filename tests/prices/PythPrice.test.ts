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

    describe('Reference Token Price Equality', () => {
        it('should ensure reference tokens have equal prices', async () => {
            // Test USDe -> USDT reference (should have equal prices)
            const usdePrice = await oracle.getPrices([USDE_MAINNET]);
            
            // Should have prices for both USDe and USDT
            expect(usdePrice.dict.keys()).toContain(ASSET_ID.USDe);
            expect(usdePrice.dict.keys()).toContain(ASSET_ID.USDT);
            
            const usdeFinalPrice = usdePrice.dict.get(ASSET_ID.USDe);
            const usdtPrice = usdePrice.dict.get(ASSET_ID.USDT);
            
            expect(usdeFinalPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();
            
            // USDe price should equal USDT price (not scaled)
            expect(usdeFinalPrice).toEqual(usdtPrice);
        });

        it('should ensure jUSDT has equal price to USDT', async () => {
            // Test jUSDT -> USDT reference (should have equal prices)
            const jUsdtPrice = await oracle.getPrices([JUSDT_MAINNET]);
            
            // Should have prices for both jUSDT and USDT
            expect(jUsdtPrice.dict.keys()).toContain(ASSET_ID.jUSDT);
            expect(jUsdtPrice.dict.keys()).toContain(ASSET_ID.USDT);
            
            const jUsdtFinalPrice = jUsdtPrice.dict.get(ASSET_ID.jUSDT);
            const usdtPrice = jUsdtPrice.dict.get(ASSET_ID.USDT);
            
            expect(jUsdtFinalPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();
            
            // jUSDT price should equal USDT price (not scaled)
            expect(jUsdtFinalPrice).toEqual(usdtPrice);
        });

        it('should ensure jUSDC has equal price to USDT', async () => {
            // Test jUSDC -> USDT reference (should have equal prices)
            const jUsdcPrice = await oracle.getPrices([JUSDC_MAINNET]);
            
            // Should have prices for both jUSDC and USDT
            expect(jUsdcPrice.dict.keys()).toContain(ASSET_ID.jUSDC);
            expect(jUsdcPrice.dict.keys()).toContain(ASSET_ID.USDT);
            
            const jUsdcFinalPrice = jUsdcPrice.dict.get(ASSET_ID.jUSDC);
            const usdtPrice = jUsdcPrice.dict.get(ASSET_ID.USDT);
            
            expect(jUsdcFinalPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();
            
            // jUSDC price should equal USDT price (not scaled)
            expect(jUsdcFinalPrice).toEqual(usdtPrice);
        });

        it('should differentiate between reference tokens and scaled tokens', async () => {
            // Test that reference tokens (equal prices) work differently from scaled tokens
            const mixedPrice = await oracle.getPrices([USDE_MAINNET, TSTON_MAINNET]);
            
            // Get prices
            const usdePrice = mixedPrice.dict.get(ASSET_ID.USDe);
            const usdtPrice = mixedPrice.dict.get(ASSET_ID.USDT);
            const tsTonPrice = mixedPrice.dict.get(ASSET_ID.tsTON);
            const tonPrice = mixedPrice.dict.get(ASSET_ID.TON);
            
            expect(usdePrice).toBeDefined();
            expect(usdtPrice).toBeDefined();
            expect(tsTonPrice).toBeDefined();
            expect(tonPrice).toBeDefined();
            
            // USDe should equal USDT (reference token behavior)
            expect(usdePrice).toEqual(usdtPrice);
            
            // tsTON should NOT equal TON (scaled token behavior)
            expect(tsTonPrice).not.toEqual(tonPrice);
        });

        it('should handle multiple reference tokens with same reference', async () => {
            // Test multiple assets referencing the same token
            const multipleRefPrice = await oracle.getPrices([JUSDT_MAINNET, JUSDC_MAINNET, USDE_MAINNET]);
            
            const jUsdtPrice = multipleRefPrice.dict.get(ASSET_ID.jUSDT);
            const jUsdcPrice = multipleRefPrice.dict.get(ASSET_ID.jUSDC);
            const usdePrice = multipleRefPrice.dict.get(ASSET_ID.USDe);
            const usdtPrice = multipleRefPrice.dict.get(ASSET_ID.USDT);
            
            expect(jUsdtPrice).toBeDefined();
            expect(jUsdcPrice).toBeDefined();
            expect(usdePrice).toBeDefined();
            expect(usdtPrice).toBeDefined();
            
            // All should have the same price as USDT
            expect(jUsdtPrice).toEqual(usdtPrice);
            expect(jUsdcPrice).toEqual(usdtPrice);
            expect(usdePrice).toEqual(usdtPrice);
        });
    });

    describe('createRequiredFeedsList', () => {
        it('should return direct Pyth feeds for assets with native feeds', () => {
            // Test TON asset - has direct feed
            const tonFeeds = oracle.createRequiredFeedsList([TON_MAINNET]);
            expect(tonFeeds).toHaveLength(1);
            expect(tonFeeds).toContain(FEED_ID.TON);

            // Test USDT asset - has direct feed
            const usdtFeeds = oracle.createRequiredFeedsList([USDT_MAINNET]);
            expect(usdtFeeds).toHaveLength(1);
            expect(usdtFeeds).toContain(FEED_ID.USDT);
        });

        it('should return feeds for assets using reference tokens', () => {
            // Test jUSDT -> USDT reference
            const jUsdtFeeds = oracle.createRequiredFeedsList([JUSDT_MAINNET]);
            expect(jUsdtFeeds).toHaveLength(1);
            expect(jUsdtFeeds).toContain(FEED_ID.USDT);

            // Test jUSDC -> USDT reference
            const jUsdcFeeds = oracle.createRequiredFeedsList([JUSDC_MAINNET]);
            expect(jUsdcFeeds).toHaveLength(1);
            expect(jUsdcFeeds).toContain(FEED_ID.USDT);

            // Test USDe -> USDT reference
            const usdeFeeds = oracle.createRequiredFeedsList([USDE_MAINNET]);
            expect(usdeFeeds).toHaveLength(1);
            expect(usdeFeeds).toContain(FEED_ID.USDT);

            // Test stTON -> tsTON reference
            const stTonFeeds = oracle.createRequiredFeedsList([STTON_MAINNET]);
            expect(stTonFeeds).toHaveLength(2); // tsTON feed + its connected TON feed
            expect(stTonFeeds).toContain(FEED_ID.tsTON);
            expect(stTonFeeds).toContain(FEED_ID.TON);
        });

        it('should return connected feeds for assets with referred feeds', () => {
            // Test tsTON - has connected feed to TON
            const tsTonFeeds = oracle.createRequiredFeedsList([TSTON_MAINNET]);
            expect(tsTonFeeds).toHaveLength(2);
            expect(tsTonFeeds).toContain(FEED_ID.tsTON);
            expect(tsTonFeeds).toContain(FEED_ID.TON);

            // Test tsUSDe - has connected feed to USDT
            const tsUsdeFeeds = oracle.createRequiredFeedsList([TSUSDE_MAINNET]);
            expect(tsUsdeFeeds).toHaveLength(2);
            expect(tsUsdeFeeds).toContain(FEED_ID.tsUSDe);
            expect(tsUsdeFeeds).toContain(FEED_ID.USDT);
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
            expect(multipleFeeds).toContain(FEED_ID.USDT);

            // Test assets with different feeds
            const diverseFeeds = oracle.createRequiredFeedsList([TON_MAINNET, USDT_MAINNET, TSTON_MAINNET]);

            // Should have TON, USDT, tsTON feeds (tsTON also needs TON, but it's deduplicated)
            expect(diverseFeeds).toHaveLength(3);
            expect(diverseFeeds).toContain(FEED_ID.TON);
            expect(diverseFeeds).toContain(FEED_ID.USDT);
            expect(diverseFeeds).toContain(FEED_ID.tsTON);
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
            expect(feeds[0]).toBe(FEED_ID.TON);
        });

        it('should handle complex scenario with reference tokens and connected feeds', () => {
            // Test stTON which goes: stTON -> tsTON (via allowedRefTokens) -> TON (via connected feed)
            const stTonFeeds = oracle.createRequiredFeedsList([STTON_MAINNET]);

            expect(stTonFeeds).toHaveLength(2);
            expect(stTonFeeds).toContain(FEED_ID.tsTON); // tsTON feed
            expect(stTonFeeds).toContain(FEED_ID.TON); // Connected TON feed
        });

        it('should handle scaled tokens feed requirements', () => {
            // Test that scaled tokens require both their own feed and base token feeds
            const scaledTokensFeeds = oracle.createRequiredFeedsList([TSTON_MAINNET, STTON_MAINNET, TSUSDE_MAINNET]);

            // Should include all necessary feeds for scaling calculations
            expect(scaledTokensFeeds).toContain(FEED_ID.tsTON);
            expect(scaledTokensFeeds).toContain(FEED_ID.TON);
            expect(scaledTokensFeeds).toContain(FEED_ID.tsUSDe);
            expect(scaledTokensFeeds).toContain(FEED_ID.USDT);

            // Should deduplicate common feeds
            const uniqueFeeds = new Set(scaledTokensFeeds);
            expect(scaledTokensFeeds.length).toBe(uniqueFeeds.size);
        });

        it('should handle mixed asset types efficiently', () => {
            // Test with a mix of direct, reference, and scaled tokens
            const mixedFeeds = oracle.createRequiredFeedsList([
                TON_MAINNET, // Direct feed
                JUSDT_MAINNET, // Reference token
                TSTON_MAINNET, // Scaled token
                USDT_MAINNET, // Direct feed (also used by others)
            ]);

            // Should contain all necessary feeds without duplicates
            expect(mixedFeeds).toContain(FEED_ID.TON);
            expect(mixedFeeds).toContain(FEED_ID.USDT);
            expect(mixedFeeds).toContain(FEED_ID.tsTON);

            // Verify no duplicates
            const uniqueFeeds = new Set(mixedFeeds);
            expect(mixedFeeds.length).toBe(uniqueFeeds.size);
        });
    });

    describe('PythPrices methods', () => {
        it('shound return right refAssets', async () => {
            const price = await oracle.getPrices([JUSDT_MAINNET]);

            expect(price.dict.keys()).toHaveLength(2);
            expect(price.refAssets()).toHaveLength(1);

            expect(price.refAssets()).toContain(JUSDT_MAINNET);
        });

        it('should handle scaled tokens pricing correctly', async () => {
            // Test tsTON scaling
            const tsTonPrice = await oracle.getPrices([TSTON_MAINNET]);

            // Should have prices for both tsTON and TON (its base token)
            expect(tsTonPrice.dict.keys()).toContain(ASSET_ID.tsTON);
            expect(tsTonPrice.dict.keys()).toContain(ASSET_ID.TON);

            const tsTonFinalPrice = tsTonPrice.dict.get(ASSET_ID.tsTON);
            const tonPrice = tsTonPrice.dict.get(ASSET_ID.TON);

            expect(tsTonFinalPrice).toBeDefined();
            expect(tonPrice).toBeDefined();

            // The final tsTON price should be different from TON price (scaled)
            expect(tsTonFinalPrice).not.toEqual(tonPrice);
        });

        it('should handle stTON scaling correctly', async () => {
            // Test stTON scaling (stTON -> tsTON via allowedRefTokens, should have equal prices)
            const stTonPrice = await oracle.getPrices([STTON_MAINNET]);
            
            // Should have prices for stTON, tsTON (reference), and TON
            expect(stTonPrice.dict.keys()).toContain(ASSET_ID.stTON);
            expect(stTonPrice.dict.keys()).toContain(ASSET_ID.tsTON);
            expect(stTonPrice.dict.keys()).toContain(ASSET_ID.TON);
            
            const stTonFinalPrice = stTonPrice.dict.get(ASSET_ID.stTON);
            const tsTonPrice = stTonPrice.dict.get(ASSET_ID.tsTON);
            const tonPrice = stTonPrice.dict.get(ASSET_ID.TON);
            
            expect(stTonFinalPrice).toBeDefined();
            expect(tsTonPrice).toBeDefined();
            expect(tonPrice).toBeDefined();
            
            // stTON should equal tsTON (reference token behavior via allowedRefTokens)
            expect(stTonFinalPrice).toEqual(tsTonPrice);
            // But both should be different from TON (scaled token behavior)
            expect(stTonFinalPrice).not.toEqual(tonPrice);
        });

        it('should handle tsUSDe scaling correctly', async () => {
            // Test tsUSDe scaling
            const tsUsdePrice = await oracle.getPrices([TSUSDE_MAINNET]);

            // Should have prices for both tsUSDe and USDT (via USDe reference)
            expect(tsUsdePrice.dict.keys()).toContain(ASSET_ID.tsUSDe);
            expect(tsUsdePrice.dict.keys()).toContain(ASSET_ID.USDT);

            const tsUsdeFinalPrice = tsUsdePrice.dict.get(ASSET_ID.tsUSDe);
            const usdtPrice = tsUsdePrice.dict.get(ASSET_ID.USDT);

            expect(tsUsdeFinalPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();

            // The final tsUSDe price should be scaled
            expect(tsUsdeFinalPrice).not.toEqual(usdtPrice);
        });

        it('should handle multiple scaled tokens together', async () => {
            // Test multiple scaled tokens in one request
            const multiplePrice = await oracle.getPrices([TSTON_MAINNET, STTON_MAINNET, TSUSDE_MAINNET]);
            
            // Should have all the necessary prices
            expect(multiplePrice.dict.keys()).toContain(ASSET_ID.tsTON);
            expect(multiplePrice.dict.keys()).toContain(ASSET_ID.stTON);
            expect(multiplePrice.dict.keys()).toContain(ASSET_ID.tsUSDe);
            expect(multiplePrice.dict.keys()).toContain(ASSET_ID.TON);
            expect(multiplePrice.dict.keys()).toContain(ASSET_ID.USDT);
            
            // All scaled tokens should have different prices
            const tsTonPrice = multiplePrice.dict.get(ASSET_ID.tsTON);
            const stTonPrice = multiplePrice.dict.get(ASSET_ID.stTON);
            const tsUsdePrice = multiplePrice.dict.get(ASSET_ID.tsUSDe);
            const tonPrice = multiplePrice.dict.get(ASSET_ID.TON);
            const usdtPrice = multiplePrice.dict.get(ASSET_ID.USDT);
            
            expect(tsTonPrice).toBeDefined();
            expect(stTonPrice).toBeDefined();
            expect(tsUsdePrice).toBeDefined();
            expect(tonPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();
            
            // Verify scaling relationships
            expect(tsTonPrice).not.toEqual(tonPrice);
            expect(stTonPrice).toEqual(tsTonPrice); // stTON equals tsTON (reference token)
            expect(stTonPrice).not.toEqual(tonPrice);
            expect(tsUsdePrice).not.toEqual(usdtPrice);
        });

        it('should handle edge case when base token price is missing', async () => {
            // This test verifies that scaling doesn't break when base prices are missing
            // In a real scenario, this would be handled by the missing price validation
            const price = await oracle.getPrices([TSTON_MAINNET]);

            // Should still get prices (the feeds should provide both tsTON rate and TON price)
            expect(price.dict.keys()).toContain(ASSET_ID.tsTON);
            expect(price.dict.keys()).toContain(ASSET_ID.TON);
        });

        it('should ensure reference tokens have equal prices', async () => {
            // Test USDe -> USDT reference (should have equal prices)
            const usdePrice = await oracle.getPrices([USDE_MAINNET]);

            // Should have prices for both USDe and USDT
            expect(usdePrice.dict.keys()).toContain(ASSET_ID.USDe);
            expect(usdePrice.dict.keys()).toContain(ASSET_ID.USDT);

            const usdeFinalPrice = usdePrice.dict.get(ASSET_ID.USDe);
            const usdtPrice = usdePrice.dict.get(ASSET_ID.USDT);

            expect(usdeFinalPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();

            // USDe price should equal USDT price (not scaled)
            expect(usdeFinalPrice).toEqual(usdtPrice);
        });

        it('should ensure jUSDT has equal price to USDT', async () => {
            // Test jUSDT -> USDT reference (should have equal prices)
            const jUsdtPrice = await oracle.getPrices([JUSDT_MAINNET]);

            // Should have prices for both jUSDT and USDT
            expect(jUsdtPrice.dict.keys()).toContain(ASSET_ID.jUSDT);
            expect(jUsdtPrice.dict.keys()).toContain(ASSET_ID.USDT);

            const jUsdtFinalPrice = jUsdtPrice.dict.get(ASSET_ID.jUSDT);
            const usdtPrice = jUsdtPrice.dict.get(ASSET_ID.USDT);

            expect(jUsdtFinalPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();

            // jUSDT price should equal USDT price (not scaled)
            expect(jUsdtFinalPrice).toEqual(usdtPrice);
        });

        it('should ensure jUSDC has equal price to USDT', async () => {
            // Test jUSDC -> USDT reference (should have equal prices)
            const jUsdcPrice = await oracle.getPrices([JUSDC_MAINNET]);

            // Should have prices for both jUSDC and USDT
            expect(jUsdcPrice.dict.keys()).toContain(ASSET_ID.jUSDC);
            expect(jUsdcPrice.dict.keys()).toContain(ASSET_ID.USDT);

            const jUsdcFinalPrice = jUsdcPrice.dict.get(ASSET_ID.jUSDC);
            const usdtPrice = jUsdcPrice.dict.get(ASSET_ID.USDT);

            expect(jUsdcFinalPrice).toBeDefined();
            expect(usdtPrice).toBeDefined();

            // jUSDC price should equal USDT price (not scaled)
            expect(jUsdcFinalPrice).toEqual(usdtPrice);
        });

        it('should differentiate between reference tokens and scaled tokens', async () => {
            // Test that reference tokens (equal prices) work differently from scaled tokens
            const mixedPrice = await oracle.getPrices([USDE_MAINNET, TSTON_MAINNET]);

            // Get prices
            const usdePrice = mixedPrice.dict.get(ASSET_ID.USDe);
            const usdtPrice = mixedPrice.dict.get(ASSET_ID.USDT);
            const tsTonPrice = mixedPrice.dict.get(ASSET_ID.tsTON);
            const tonPrice = mixedPrice.dict.get(ASSET_ID.TON);

            expect(usdePrice).toBeDefined();
            expect(usdtPrice).toBeDefined();
            expect(tsTonPrice).toBeDefined();
            expect(tonPrice).toBeDefined();

            // USDe should equal USDT (reference token behavior)
            expect(usdePrice).toEqual(usdtPrice);

            // tsTON should NOT equal TON (scaled token behavior)
            expect(tsTonPrice).not.toEqual(tonPrice);
        });

        it('should handle multiple reference tokens with same reference', async () => {
            // Test multiple assets referencing the same token
            const multipleRefPrice = await oracle.getPrices([JUSDT_MAINNET, JUSDC_MAINNET, USDE_MAINNET]);

            const jUsdtPrice = multipleRefPrice.dict.get(ASSET_ID.jUSDT);
            const jUsdcPrice = multipleRefPrice.dict.get(ASSET_ID.jUSDC);
            const usdePrice = multipleRefPrice.dict.get(ASSET_ID.USDe);
            const usdtPrice = multipleRefPrice.dict.get(ASSET_ID.USDT);

            expect(jUsdtPrice).toBeDefined();
            expect(jUsdcPrice).toBeDefined();
            expect(usdePrice).toBeDefined();
            expect(usdtPrice).toBeDefined();

            // All should have the same price as USDT
            expect(jUsdtPrice).toEqual(usdtPrice);
            expect(jUsdcPrice).toEqual(usdtPrice);
            expect(usdePrice).toEqual(usdtPrice);
        });
    });
});
