import { Cell, Dictionary } from '@ton/core';
import {
    ASSET_ID,
    DefaultPythPriceSourcesConfig,
    EVAA_JUSDT_PRICE_FEED_ID,
    FetchConfig,
    JUSDT_MAINNET,
    packConnectedFeeds,
    PYTH_ORACLE_MAINNET,
    PYTH_TON_PRICE_FEED_ID,
    PYTH_TSTON_PRICE_FEED_ID,
    PYTH_USDT_PRICE_FEED_ID,
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

    describe('Advanced Feed Scenarios', () => {
        it('should handle mixed feed types together', async () => {
            const mixedAssets = [
                TON_MAINNET, // Direct pyth feed
                TSTON_MAINNET, // Referred pyth feed (tsTON->TON)
                JUSDT_MAINNET, // AllowedRefToken (jUSDT->USDT)
                USDT_MAINNET, // Direct pyth feed
            ];
            const prices = await oracle.getPrices(mixedAssets, fetchConfig);

            expect(prices.dict.size).toBe(mixedAssets.length);
            mixedAssets.forEach((asset) => {
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
            const emptyAssets: (typeof TON_MAINNET)[] = [];
            const prices = await oracle.getPrices(emptyAssets, fetchConfig);

            expect(prices.dict.size).toBe(0);
            expect(prices.dataCell.hash()).toEqual(Cell.EMPTY.hash());
        });
    });

    describe('Feed List Generation', () => {
        it('should generate feeds including references for referred assets', () => {
            const evaaIds = [TSTON_MAINNET.assetId]; // tsTON refers to TON
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);

            // Should include both tsTON feed and its referred TON feed
            expect(requiredFeeds).toContain('0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25'); // tsTON
            expect(requiredFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON (referred)
            expect(requiredFeeds).toHaveLength(2);
        });

        it('should deduplicate feeds for complex scenarios', () => {
            const evaaIds = [
                TON_MAINNET.assetId, // Direct TON feed
                TSTON_MAINNET.assetId, // Refers to TON feed
                USDT_MAINNET.assetId, // Direct USDT feed
                JUSDT_MAINNET.assetId, // Refers to USDT feed
            ];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);

            // Should contain unique feeds: TON, USDT, tsTON
            expect(requiredFeeds).toHaveLength(3);
            expect(requiredFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON
            expect(requiredFeeds).toContain('0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'); // USDT
            expect(requiredFeeds).toContain('0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25'); // tsTON
        });
    });

    describe('Error Handling', () => {
        it('should throw error for assets from different pool', async () => {
            // Create fake principals with assets not in the pool config
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(999999n, 5n); // Non-existent asset

            await expect(oracle.getPricesForLiquidate(principals, fetchConfig)).rejects.toThrow(
                'User from another pool',
            );
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
                    fetchConfig,
                ),
            ).rejects.toThrow('Cannot debt only one supplied asset');
        });
    });

    describe('Pool Configuration Tests', () => {
        it('should handle supply/withdraw with asset addition', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 100n);
            principals.set(USDT_MAINNET.assetId, 50n);

            const prices = await oracle.getPricesForSupplyWithdraw(
                principals,
                undefined, // Supply asset
                TSTON_MAINNET, // Withdraw asset (will be added to required assets)
                true,
                fetchConfig,
            );

            // The method adds the withdrawAsset to existing assets from principals
            // So we should have: TON (from principals), USDT (from principals), tsTON (added as withdrawAsset)
            expect(prices.dict.size).toBe(3); // TON, USDT, tsTON
            expect(prices.dict.get(TON_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(USDT_MAINNET.assetId)).toBeDefined();
            expect(prices.dict.get(TSTON_MAINNET.assetId)).toBeDefined();
        });
    });
});
