import { Cell, Dictionary } from '@ton/core';
import {
    DEFAULT_FEEDS_MAP,
    MAINNET_POOL_CONFIG,
    OracleInfo,
    PYTH_ORACLE_MAINNET,
    PythCollector,
    STTON_MAINNET,
    TON_MAINNET,
    USDT_MAINNET,
} from '../../src';

describe('PythOracle', () => {
    let oracle: PythCollector;
    let oracleInfo: OracleInfo;

    beforeEach(() => {
        const feedsMap = DEFAULT_FEEDS_MAP;
        oracleInfo = {
            pythAddress: PYTH_ORACLE_MAINNET,
            feedsMap: feedsMap,
            pricesTtl: 180,
            pythComputeBaseGas: 1n,
            pythComputePerUpdateGas: 1n,
            pythSingleUpdateFee: 1n,
        };
        oracle = new PythCollector(oracleInfo, MAINNET_POOL_CONFIG.poolAssetsConfig);
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
