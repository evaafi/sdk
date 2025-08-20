import { Cell, Dictionary } from '@ton/core';
import {
    ASSET_ID,
    DefaultPythPriceSourcesConfig,
    EVAA_JUSDT_PRICE_FEED_ID,
    FetchConfig,
    JUSDT_MAINNET,
    JUSDC_MAINNET,
    STTON_MAINNET,
    USDE_MAINNET,
    TSUSDE_MAINNET,
    packConnectedFeeds,
    PYTH_ORACLE_MAINNET,
    PYTH_TON_PRICE_FEED_ID,
    PYTH_TSTON_PRICE_FEED_ID,
    PYTH_USDT_PRICE_FEED_ID,
    PYTH_STTON_PRICE_FEED_ID,
    PYTH_USDC_PRICE_FEED_ID,
    PYTH_USDE_PRICE_FEED_ID,
    PYTH_TSUDE_PRICE_FEED_ID,
    PythCollector,
    TON_MAINNET,
    TSTON_MAINNET,
    USDT_MAINNET,
} from '../../src';

describe('PythOracle', () => {
    let oracle: PythCollector;
    let fetchConfig: FetchConfig;

    beforeEach(() => {
        oracle = new PythCollector({
            poolAssetsConfig: [TON_MAINNET, USDT_MAINNET, TSTON_MAINNET],
            pythOracle: {
                feedsMap: Dictionary.empty<bigint, Buffer>()
                    .set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.TON, 0n))
                    .set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDT, 0n))
                    .set(
                        BigInt(PYTH_TSTON_PRICE_FEED_ID),
                        packConnectedFeeds(ASSET_ID.tsTON, BigInt(PYTH_TON_PRICE_FEED_ID)),
                    ),
                pythAddress: PYTH_ORACLE_MAINNET,
                allowedRefTokens: Dictionary.empty<bigint, bigint>().set(
                    BigInt(EVAA_JUSDT_PRICE_FEED_ID),
                    BigInt(ASSET_ID.USDT),
                ),
            },
            pythConfig: DefaultPythPriceSourcesConfig,
        });

        fetchConfig = {
            retries: 3,
            timeout: 1000,
        };
    });

    describe('Feeds', () => {
        it('should create a required feeds list for basic assets', () => {
            const evaaIds = [TON_MAINNET.assetId, USDT_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            expect(requiredFeeds).toHaveLength(2);
            expect(requiredFeeds).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/^0x[0-9a-f]+$/),
                    expect.stringMatching(/^0x[0-9a-f]+$/),
                ]),
            );
        });

        it('should handle empty input array', () => {
            const requiredFeeds = oracle.createRequiredFeedsList([]);
            expect(requiredFeeds).toHaveLength(0);
            expect(requiredFeeds).toEqual([]);
        });

        it('should handle single asset', () => {
            const evaaIds = [TON_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            expect(requiredFeeds).toHaveLength(1);
            expect(requiredFeeds[0]).toMatch(/^0x[0-9a-f]+$/);
        });

        it('should include referred feeds for assets with references', () => {
            // tsTON has a reference to TON feed
            const evaaIds = [TSTON_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            // Should include both tsTON feed and its referred TON feed
            expect(requiredFeeds.length).toBeGreaterThanOrEqual(1);
            expect(requiredFeeds).toEqual(expect.arrayContaining([expect.stringMatching(/^0x[0-9a-f]+$/)]));
        });

        it('should handle duplicate evaaIds without duplicating feeds', () => {
            const evaaIds = [TON_MAINNET.assetId, TON_MAINNET.assetId, USDT_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            expect(requiredFeeds).toHaveLength(2); // Should deduplicate
        });

        it('should handle non-existent evaaIds gracefully', () => {
            const nonExistentId = 999999n;
            const evaaIds = [TON_MAINNET.assetId, nonExistentId, USDT_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            expect(requiredFeeds).toHaveLength(2); // Should only include existing feeds
        });

        it('should return hex strings with 0x prefix', () => {
            const evaaIds = [TON_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            requiredFeeds.forEach((feed) => {
                expect(feed).toMatch(/^0x[0-9a-f]+$/);
                expect(feed.length).toBeGreaterThan(2); // More than just "0x"
            });
        });

        it('should handle mixed assets with and without references', () => {
            const evaaIds = [TON_MAINNET.assetId, TSTON_MAINNET.assetId, USDT_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            expect(requiredFeeds.length).toBeGreaterThanOrEqual(3);
            requiredFeeds.forEach((feed) => {
                expect(feed).toMatch(/^0x[0-9a-f]+$/);
            });
        });
    });

    describe('Prices', () => {
        it('should get prices', async () => {
            const assets = [TON_MAINNET, USDT_MAINNET];
            const prices = await oracle.getPrices(assets, fetchConfig);
            expect(prices.dict.size).toBeGreaterThan(0);
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should get prices for liquidate', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 5n);
            principals.set(USDT_MAINNET.assetId, -5n);

            const prices = await oracle.getPricesForLiquidate(principals, fetchConfig);
            expect(prices.dict.size).toBe(2);
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should get prices for supply/withdraw', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 5n);
            principals.set(USDT_MAINNET.assetId, 5n);

            const prices = await oracle.getPricesForSupplyWithdraw(principals, undefined, TSTON_MAINNET, true, {
                retries: 1,
                timeout: 1000,
            });
            expect(prices.dict.size).toBe(3);
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });
    });

    describe('Prices Ref-token', () => {
        it('shoud get prices for ref-token jusdt->usdt', async () => {
            const assets = [JUSDT_MAINNET];
            const prices = await oracle.getPrices(assets, fetchConfig);

            expect(prices.dict.size).toBe(assets.length);
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });
    });

    describe('Comprehensive Feed Scenarios', () => {
        it('should handle direct pyth feeds only', async () => {
            const directAssets = [TON_MAINNET, USDT_MAINNET];
            const prices = await oracle.getPrices(directAssets, fetchConfig);
            
            expect(prices.dict.size).toBe(directAssets.length);
            expect(prices.dict.get(TON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(USDT_MAINNET.assetId)).toBeDefined();
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should handle referred pyth feeds (tsTON->TON)', async () => {
            const referredAssets = [TSTON_MAINNET];
            const prices = await oracle.getPrices(referredAssets, fetchConfig);
            
            expect(prices.dict.size).toBe(referredAssets.length);
            expect(prices.dict.get(TSTON_MAINNET.assetId)).toBeDefined();
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should handle allowedRefTokens (jUSDT->USDT)', async () => {
            const refTokenAssets = [JUSDT_MAINNET];
            const prices = await oracle.getPrices(refTokenAssets, fetchConfig);
            
            expect(prices.dict.size).toBe(refTokenAssets.length);
            expect(prices.dict.get(JUSDT_MAINNET.assetId)).toBeDefined();
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should handle mixed feed types together', async () => {
            const mixedAssets = [
                TON_MAINNET,    // Direct pyth feed
                TSTON_MAINNET,  // Referred pyth feed (tsTON->TON)
                JUSDT_MAINNET,  // AllowedRefToken (jUSDT->USDT)
                USDT_MAINNET    // Direct pyth feed
            ];
            const prices = await oracle.getPrices(mixedAssets, fetchConfig);
            
            expect(prices.dict.size).toBe(mixedAssets.length);
            mixedAssets.forEach(asset => {
                expect(prices.dict.get(asset.assetId)).toBeDefined();
            });
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should handle duplicate assets without duplicating prices', async () => {
            const duplicateAssets = [TON_MAINNET, TON_MAINNET, USDT_MAINNET];
            const prices = await oracle.getPrices(duplicateAssets, fetchConfig);
            
            // Should still return prices for unique assets
            expect(prices.dict.size).toBe(2); // TON and USDT only
            expect(prices.dict.get(TON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(USDT_MAINNET.assetId)).toBeDefined();
        });

        it('should handle empty asset list', async () => {
            const emptyAssets: typeof TON_MAINNET[] = [];
            const prices = await oracle.getPrices(emptyAssets, fetchConfig);
            
            expect(prices.dict.size).toBe(0);
            expect(prices.dataCell.hash()).toEqual(Cell.EMPTY.hash());
        });
    });

    describe('Feed List Generation', () => {
        it('should generate correct feeds for direct assets', () => {
            const evaaIds = [TON_MAINNET.assetId, USDT_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            
            expect(requiredFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON
            expect(requiredFeeds).toContain('0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'); // USDT
            expect(requiredFeeds).toHaveLength(2);
        });

        it('should generate feeds including references for referred assets', () => {
            const evaaIds = [TSTON_MAINNET.assetId]; // tsTON refers to TON
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            
            // Should include both tsTON feed and its referred TON feed
            expect(requiredFeeds).toContain('0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25'); // tsTON
            expect(requiredFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON (referred)
            expect(requiredFeeds).toHaveLength(2);
        });

        it('should generate feeds for allowedRefTokens', () => {
            const evaaIds = [JUSDT_MAINNET.assetId]; // jUSDT -> USDT
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            
            // Should include USDT feed (base of jUSDT)
            expect(requiredFeeds).toContain('0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'); // USDT
            expect(requiredFeeds).toHaveLength(1);
        });

        it('should deduplicate feeds for complex scenarios', () => {
            const evaaIds = [
                TON_MAINNET.assetId,    // Direct TON feed
                TSTON_MAINNET.assetId,  // Refers to TON feed
                USDT_MAINNET.assetId,   // Direct USDT feed  
                JUSDT_MAINNET.assetId   // Refers to USDT feed
            ];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            
            // Should contain unique feeds: TON, USDT, tsTON
            expect(requiredFeeds).toHaveLength(3);
            expect(requiredFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON
            expect(requiredFeeds).toContain('0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'); // USDT
            expect(requiredFeeds).toContain('0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25'); // tsTON
        });

        it('should handle non-existent assets gracefully', () => {
            const nonExistentId = 999999999n;
            const evaaIds = [TON_MAINNET.assetId, nonExistentId, USDT_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            
            // Should only include feeds for existing assets
            expect(requiredFeeds).toHaveLength(2);
            expect(requiredFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON
            expect(requiredFeeds).toContain('0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'); // USDT
        });
    });

    describe('Error Handling', () => {
        it('should throw error for assets from different pool', async () => {
            // Create fake principals with assets not in the pool config
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(999999n, 5n); // Non-existent asset
            
            await expect(oracle.getPricesForLiquidate(principals, fetchConfig))
                .rejects.toThrow('User from another pool');
        });

        it('should throw error when trying to debt only one supplied asset', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 5n);
            
            await expect(
                oracle.getPricesForSupplyWithdraw(
                    principals, 
                    undefined, 
                    undefined, 
                    true, // collateralToDebt = true
                    fetchConfig
                )
            ).rejects.toThrow('Cannot debt only one supplied asset');
        });
    });

    describe('Complete Pool Configuration Tests', () => {
        let mainPoolOracle: PythCollector;
        let stablePoolOracle: PythCollector;

        beforeEach(() => {
            // Main pool oracle with comprehensive feed mapping
            // Note: MAIN_POOL_FEEDS_MAP has USDT mapped twice, so we'll create a cleaner version
            const comprehensiveFeedsMap = Dictionary.empty<bigint, Buffer>()
                .set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.TON, 0n))
                .set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDT, 0n))
                .set(BigInt(PYTH_STTON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.stTON, BigInt(PYTH_TON_PRICE_FEED_ID)))
                .set(BigInt(PYTH_TSTON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.tsTON, BigInt(PYTH_TON_PRICE_FEED_ID)))
                .set(BigInt(PYTH_USDC_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.jUSDC, 0n))
                .set(BigInt(PYTH_USDE_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDe, 0n))
                .set(BigInt(PYTH_TSUDE_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.tsUSDe, 0n));

            mainPoolOracle = new PythCollector({
                poolAssetsConfig: [
                    TON_MAINNET, USDT_MAINNET, TSTON_MAINNET, STTON_MAINNET, 
                    JUSDC_MAINNET, USDE_MAINNET, TSUSDE_MAINNET
                ],
                pythOracle: {
                    feedsMap: comprehensiveFeedsMap,
                    pythAddress: PYTH_ORACLE_MAINNET,
                    allowedRefTokens: Dictionary.empty<bigint, bigint>()
                        .set(BigInt(EVAA_JUSDT_PRICE_FEED_ID), BigInt(ASSET_ID.USDT)),
                },
                pythConfig: DefaultPythPriceSourcesConfig,
            });

            // Stable pool oracle
            stablePoolOracle = new PythCollector({
                poolAssetsConfig: [USDT_MAINNET, JUSDC_MAINNET, USDE_MAINNET, TSUSDE_MAINNET],
                pythOracle: {
                    feedsMap: Dictionary.empty<bigint, Buffer>()
                        .set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDT, 0n))
                        .set(BigInt(PYTH_USDC_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.jUSDC, 0n))
                        .set(BigInt(PYTH_USDE_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDe, 0n))
                        .set(BigInt(PYTH_TSUDE_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.tsUSDe, 0n)),
                    pythAddress: PYTH_ORACLE_MAINNET,
                    allowedRefTokens: Dictionary.empty<bigint, bigint>(),
                },
                pythConfig: DefaultPythPriceSourcesConfig,
            });
        });

        it('should handle main pool with all asset types', async () => {
            const mainPoolAssets = [
                TON_MAINNET,     // Direct feed
                TSTON_MAINNET,   // Referred feed (tsTON->TON)
                STTON_MAINNET,   // Referred feed (stTON->TON) 
                USDT_MAINNET,    // Direct feed
                JUSDC_MAINNET,   // Direct feed (maps to jUSDC)
                USDE_MAINNET,    // Direct feed
                TSUSDE_MAINNET   // Direct feed (maps to tsUSDe)
            ];

            const prices = await mainPoolOracle.getPrices(mainPoolAssets, fetchConfig);
            
            expect(prices.dict.size).toBe(mainPoolAssets.length);
            mainPoolAssets.forEach(asset => {
                expect(prices.dict.get(asset.assetId)).toBeDefined();
            });
        });

        it('should handle stable pool assets', async () => {
            const stableAssets = [USDT_MAINNET, JUSDC_MAINNET, USDE_MAINNET, TSUSDE_MAINNET];
            const prices = await stablePoolOracle.getPrices(stableAssets, fetchConfig);
            
            expect(prices.dict.size).toBe(stableAssets.length);
            stableAssets.forEach(asset => {
                expect(prices.dict.get(asset.assetId)).toBeDefined();
            });
        });

        it('should handle complex liquidation scenario with multiple asset types', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 100n);      // Supply
            principals.set(TSTON_MAINNET.assetId, 50n);     // Supply (referred)
            principals.set(USDT_MAINNET.assetId, -200n);    // Debt
            principals.set(USDE_MAINNET.assetId, -50n);     // Debt

            const prices = await mainPoolOracle.getPricesForLiquidate(principals, fetchConfig);
            
            expect(prices.dict.size).toBe(4);
            expect(prices.dict.get(TON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(TSTON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(USDT_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(USDE_MAINNET.assetId)).toBeDefined();
        });

        it('should handle supply/withdraw with asset addition', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 100n);
            principals.set(USDT_MAINNET.assetId, 50n);

            const prices = await mainPoolOracle.getPricesForSupplyWithdraw(
                principals, 
                undefined, // Supply asset  
                STTON_MAINNET, // Withdraw asset (will be added to required assets)
                true, 
                fetchConfig
            );
            
            // The method adds the withdrawAsset to existing assets from principals
            // So we should have: TON (from principals), USDT (from principals), stTON (added as withdrawAsset)
            expect(prices.dict.size).toBe(3); // TON, USDT, stTON
            expect(prices.dict.get(TON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(USDT_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(STTON_MAINNET.assetId)).toBeDefined();
        });
    });

    describe('Feed Map Coverage Tests', () => {
        it('should verify all main pool feeds are mapped correctly', () => {
            // Create a comprehensive feed map without conflicts
            const cleanFeedsMap = Dictionary.empty<bigint, Buffer>()
                .set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.TON, 0n))
                .set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDT, 0n))
                .set(BigInt(PYTH_STTON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.stTON, BigInt(PYTH_TON_PRICE_FEED_ID)))
                .set(BigInt(PYTH_TSTON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.tsTON, BigInt(PYTH_TON_PRICE_FEED_ID)))
                .set(BigInt(PYTH_USDC_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.jUSDC, 0n))
                .set(BigInt(PYTH_USDE_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDe, 0n))
                .set(BigInt(PYTH_TSUDE_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.tsUSDe, 0n));

            const mainPoolOracle = new PythCollector({
                poolAssetsConfig: [
                    TON_MAINNET, USDT_MAINNET, TSTON_MAINNET, STTON_MAINNET, 
                    JUSDC_MAINNET, USDE_MAINNET, TSUSDE_MAINNET
                ],
                pythOracle: {
                    feedsMap: cleanFeedsMap,
                    pythAddress: PYTH_ORACLE_MAINNET,
                    allowedRefTokens: Dictionary.empty<bigint, bigint>(),
                },
                pythConfig: DefaultPythPriceSourcesConfig,
            });

            // Test direct mappings
            const tonFeeds = mainPoolOracle.createRequiredFeedsList([TON_MAINNET.assetId]);
            expect(tonFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026');

            const usdtFeeds = mainPoolOracle.createRequiredFeedsList([USDT_MAINNET.assetId]);
            expect(usdtFeeds).toContain('0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b');

            // Test referred mappings
            const tstonFeeds = mainPoolOracle.createRequiredFeedsList([TSTON_MAINNET.assetId]);
            expect(tstonFeeds).toContain('0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25'); // tsTON
            expect(tstonFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON (referred)

            const sttonFeeds = mainPoolOracle.createRequiredFeedsList([STTON_MAINNET.assetId]);
            expect(sttonFeeds).toContain('0x9145e059026a4d5a46f3b96408f7e572e33b3257b9c2dbe8dba551c772762002'); // stTON
            expect(sttonFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON (referred)
        });

        it('should handle edge case of asset requiring multiple feed references', async () => {
            // Test scenario where we request both referring and referred assets
            const mainPoolOracle = new PythCollector({
                poolAssetsConfig: [TON_MAINNET, TSTON_MAINNET, STTON_MAINNET],
                pythOracle: {
                    feedsMap: Dictionary.empty<bigint, Buffer>()
                        .set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.TON, 0n))
                        .set(BigInt(PYTH_TSTON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.tsTON, BigInt(PYTH_TON_PRICE_FEED_ID)))
                        .set(BigInt(PYTH_STTON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.stTON, BigInt(PYTH_TON_PRICE_FEED_ID))),
                    pythAddress: PYTH_ORACLE_MAINNET,
                    allowedRefTokens: Dictionary.empty<bigint, bigint>(),
                },
                pythConfig: DefaultPythPriceSourcesConfig,
            });

            const assetsWithReferences = [TON_MAINNET, TSTON_MAINNET, STTON_MAINNET];
            const prices = await mainPoolOracle.getPrices(assetsWithReferences, fetchConfig);
            
            // Should get prices for exactly the requested assets (3)
            expect(prices.dict.size).toBe(3);
            expect(prices.dict.get(TON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(TSTON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(STTON_MAINNET.assetId)).toBeDefined();
        });
    });
});
