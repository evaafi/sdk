import { Cell, Dictionary } from '@ton/core';
import {
    DEFAULT_FEEDS_MAP,
    DefaultPythPriceSourcesConfig,
    MAINNET_POOL_ASSETS_CONFIG,
    PYTH_ORACLE_TESTNET,
    PythCollector,
    STTON_MAINNET,
    TON_MAINNET,
    USDT_MAINNET,
} from '../../src';

describe('PythOracle', () => {
    let oracle: PythCollector;

    beforeEach(() => {
        oracle = new PythCollector({
            poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
            pythOracle: {
                feedsMap: DEFAULT_FEEDS_MAP,
                pythAddress: PYTH_ORACLE_TESTNET,
                allowedRefTokens: Dictionary.empty(),
            },
            pythConfig: DefaultPythPriceSourcesConfig,
        });
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
            // stTON has a reference to TON feed
            const evaaIds = [STTON_MAINNET.assetId];
            const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
            // Should include both stTON feed and its referred TON feed
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
            const evaaIds = [TON_MAINNET.assetId, STTON_MAINNET.assetId, USDT_MAINNET.assetId];
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
            const prices = await oracle.getPrices(assets, { retries: 1, timeout: 1000 });
            expect(prices.dict.size).toBeGreaterThan(0);
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should get prices for liquidate', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 5n);
            principals.set(USDT_MAINNET.assetId, -5n);

            const prices = await oracle.getPricesForLiquidate(principals, { retries: 1, timeout: 1000 });
            expect(prices.dict.size).toBe(2);
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });

        it('should get prices for supply/withdraw', async () => {
            const principals = Dictionary.empty<bigint, bigint>();
            principals.set(TON_MAINNET.assetId, 5n);
            principals.set(USDT_MAINNET.assetId, 5n);

            const prices = await oracle.getPricesForSupplyWithdraw(principals, undefined, STTON_MAINNET, true, {
                retries: 1,
                timeout: 1000,
            });
            expect(prices.dict.size).toBe(3);
            expect(prices.dataCell.hash()).not.toEqual(Cell.EMPTY.hash());
        });
    });
});
