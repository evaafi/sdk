import { HexString } from '@pythnetwork/hermes-client';
import { Cell, Dictionary } from '@ton/core';
import {
    ASSET_ID,
    DefaultPythPriceSourcesConfig,
    FEED_ID,
    FeedMapItem,
    FetchConfig,
    JUSDT_MAINNET,
    PYTH_ORACLE_MAINNET,
    PythCollector,
    TON_MAINNET,
    TSTON_MAINNET,
    UNDEFINED_ASSET,
    USDT_MAINNET,
} from '../../src';

describe('PythOracle', () => {
    let oracle: PythCollector;
    let fetchConfig: FetchConfig;

    beforeEach(() => {
        oracle = new PythCollector({
            poolAssetsConfig: [TON_MAINNET, USDT_MAINNET, TSTON_MAINNET],
            pythOracle: {
                feedsMap: new Map<HexString, FeedMapItem>([
                    [FEED_ID.TON, { assetId: ASSET_ID.TON, feedId: '0x0' }],
                    [FEED_ID.USDT, { assetId: ASSET_ID.USDT, feedId: '0x0' }],
                    [FEED_ID.tsTON, { assetId: ASSET_ID.tsTON, feedId: FEED_ID.TON }],
                ]),
                pythAddress: PYTH_ORACLE_MAINNET,
                allowedRefTokens: Dictionary.empty<bigint, bigint>().set(BigInt(ASSET_ID.jUSDT), BigInt(ASSET_ID.USDT)),
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
            const evaaAssets = [TON_MAINNET, USDT_MAINNET];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaAssets);
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
            const evaaAssets = [TSTON_MAINNET];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaAssets);
            // Should include both tsTON feed and its referred TON feed
            expect(requiredFeeds.length).toBeGreaterThanOrEqual(1);
            expect(requiredFeeds).toEqual(expect.arrayContaining([expect.stringMatching(/^0x[0-9a-f]+$/)]));
        });

        it('should handle duplicate assetIds without duplicating feeds', () => {
            const evaaAssets = [TON_MAINNET, TON_MAINNET, USDT_MAINNET];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaAssets);
            expect(requiredFeeds).toHaveLength(2); // Should deduplicate
        });

        it('should handle non-existent assetIds gracefully', () => {
            const evaaAssets = [TON_MAINNET, UNDEFINED_ASSET, USDT_MAINNET];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaAssets);
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

            const prices = await oracle.getPricesForSupplyWithdraw(principals, TON_MAINNET, TSTON_MAINNET, true, {
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

            expect(prices.dict.size).toBe(assets.length + 1); // +1 for USDT feed
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
            const evaaAssets = [TSTON_MAINNET]; // tsTON refers to TON
            const requiredFeeds = oracle.createRequiredFeedsList(evaaAssets);

            // Should include both tsTON feed and its referred TON feed
            expect(requiredFeeds).toContain('0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25'); // tsTON
            expect(requiredFeeds).toContain('0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026'); // TON (referred)
            expect(requiredFeeds).toHaveLength(2);
        });

        it('should deduplicate feeds for complex scenarios', () => {
            const evaaAssets = [
                TON_MAINNET, // Direct TON feed
                TSTON_MAINNET, // Refers to TON feed
                USDT_MAINNET, // Direct USDT feed
                JUSDT_MAINNET, // Refers to USDT feed
            ];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaAssets);

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
                    TON_MAINNET,
                    TON_MAINNET,
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
                TON_MAINNET, // Supply asset
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
