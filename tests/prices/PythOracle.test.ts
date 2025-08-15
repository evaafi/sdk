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

    it('should create a required feeds list', () => {
        const evaaIds = [TON_MAINNET.assetId, USDT_MAINNET.assetId];
        const requiredFeeds = oracle.createRequiredFeedsList(evaaIds);
        expect(requiredFeeds).toHaveLength(2);
    });

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
