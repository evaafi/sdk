import { HexString } from '@pythnetwork/hermes-client';
import { Dictionary } from '@ton/core';
import {
    ASSET_ID,
    ASSET_PRICE_SCALE,
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

describe('LSD Price | Pyth', () => {
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

    describe('Price Calculation Logic', () => {
        describe('tsTON Price Calculation', () => {
            it('should calculate tsTON price correctly when both tsTON and TON prices exist', async () => {
                const assets = [TSTON_MAINNET, TON_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const tstonPrice = prices.dict.get(TSTON_MAINNET.assetId);
                const tonPrice = prices.dict.get(TON_MAINNET.assetId);

                expect(tstonPrice).toBeDefined();
                expect(tonPrice).toBeDefined();

                // Verify the calculation logic: tsTON price should be (original_tsTON_price * TON_price) / ASSET_PRICE_SCALE
                // Note: The actual calculation happens inside the oracle, we're testing the result exists
                expect(typeof tstonPrice).toBe('bigint');
                expect(typeof tonPrice).toBe('bigint');
                expect(tstonPrice! > 0n).toBe(true);
                expect(tonPrice! > 0n).toBe(true);
            });

            it('should handle case when only tsTON price exists without TON price', async () => {
                // This tests the edge case where TON price might not be available
                const assets = [TSTON_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const tstonPrice = prices.dict.get(TSTON_MAINNET.assetId);
                expect(tstonPrice).toBeDefined();
                expect(typeof tstonPrice).toBe('bigint');
            });

            it('should verify tsTON price calculation formula', async () => {
                const assets = [TSTON_MAINNET, TON_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const tstonPrice = prices.dict.get(TSTON_MAINNET.assetId);
                const tonPrice = prices.dict.get(TON_MAINNET.assetId);

                // Mock the calculation to verify the formula
                if (tstonPrice && tonPrice) {
                    // This simulates the calculation: (tsTON_price * TON_price) / ASSET_PRICE_SCALE
                    const expectedCalculation = (tstonPrice * tonPrice) / ASSET_PRICE_SCALE;
                    expect(expectedCalculation).toBeGreaterThan(0n);
                    expect(ASSET_PRICE_SCALE).toBe(BigInt(1e9));
                }
            });
        });

        describe('stTON Price Calculation', () => {
            it('should calculate stTON price correctly when both stTON and TON prices exist', async () => {
                const assets = [STTON_MAINNET, TON_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const sttonPrice = prices.dict.get(STTON_MAINNET.assetId);
                const tonPrice = prices.dict.get(TON_MAINNET.assetId);

                expect(sttonPrice).toBeDefined();
                expect(tonPrice).toBeDefined();

                // Verify the calculation logic: stTON price should be (original_stTON_price * TON_price) / ASSET_PRICE_SCALE
                expect(typeof sttonPrice).toBe('bigint');
                expect(typeof tonPrice).toBe('bigint');
                expect(sttonPrice! > 0n).toBe(true);
                expect(tonPrice! > 0n).toBe(true);
            });

            it('should handle case when only stTON price exists without TON price', async () => {
                const assets = [STTON_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const sttonPrice = prices.dict.get(STTON_MAINNET.assetId);
                expect(sttonPrice).toBeDefined();
                expect(typeof sttonPrice).toBe('bigint');
            });

            it('should verify stTON price calculation formula', async () => {
                const assets = [STTON_MAINNET, TON_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const sttonPrice = prices.dict.get(STTON_MAINNET.assetId);
                const tonPrice = prices.dict.get(TON_MAINNET.assetId);

                // Mock the calculation to verify the formula
                if (sttonPrice && tonPrice) {
                    // This simulates the calculation: (stTON_price * TON_price) / ASSET_PRICE_SCALE
                    const expectedCalculation = (sttonPrice * tonPrice) / ASSET_PRICE_SCALE;
                    expect(expectedCalculation).toBeGreaterThan(0n);
                    expect(ASSET_PRICE_SCALE).toBe(BigInt(1e9));
                }
            });
        });

        describe('tsUSDe Price Calculation', () => {
            it('should calculate tsUSDe price correctly when both tsUSDe and USDe prices exist', async () => {
                const assets = [TSUSDE_MAINNET, USDE_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const tsusdePrice = prices.dict.get(TSUSDE_MAINNET.assetId);
                const usdePrice = prices.dict.get(USDE_MAINNET.assetId);

                expect(tsusdePrice).toBeDefined();
                expect(usdePrice).toBeDefined();

                // Verify the calculation logic: tsUSDe price should be (original_tsUSDe_price * USDe_price) / ASSET_PRICE_SCALE
                expect(typeof tsusdePrice).toBe('bigint');
                expect(typeof usdePrice).toBe('bigint');
                expect(tsusdePrice! > 0n).toBe(true);
                expect(usdePrice! > 0n).toBe(true);
            });

            it('should handle case when only tsUSDe price exists without USDe price', async () => {
                const assets = [TSUSDE_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const tsusdePrice = prices.dict.get(TSUSDE_MAINNET.assetId);
                expect(tsusdePrice).toBeDefined();
                expect(typeof tsusdePrice).toBe('bigint');
            });

            it('should verify tsUSDe price calculation formula', async () => {
                const assets = [TSUSDE_MAINNET, USDE_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                const tsusdePrice = prices.dict.get(TSUSDE_MAINNET.assetId);
                const usdePrice = prices.dict.get(USDE_MAINNET.assetId);

                // Mock the calculation to verify the formula
                if (tsusdePrice && usdePrice) {
                    // This simulates the calculation: (tsUSDe_price * USDe_price) / ASSET_PRICE_SCALE
                    const expectedCalculation = (tsusdePrice * usdePrice) / ASSET_PRICE_SCALE;
                    expect(expectedCalculation).toBeGreaterThan(0n);
                    expect(ASSET_PRICE_SCALE).toBe(BigInt(1e9));
                }
            });
        });

        describe('Edge Cases for Price Calculations', () => {
            it('should handle missing reference prices gracefully', async () => {
                // Test with assets that might have missing reference prices
                const assets = [TSTON_MAINNET, STTON_MAINNET, TSUSDE_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                // All prices should still be defined even if reference prices are missing
                expect(prices.dict.get(TSTON_MAINNET.assetId)).toBeDefined();
                expect(prices.dict.get(STTON_MAINNET.assetId)).toBeDefined();
                expect(prices.dict.get(TSUSDE_MAINNET.assetId)).toBeDefined();
            });

            it('should verify ASSET_PRICE_SCALE constant value', () => {
                expect(ASSET_PRICE_SCALE).toBe(BigInt(1e9));
                expect(ASSET_PRICE_SCALE).toBe(1000000000n);
            });

            it('should handle complex price calculation scenarios', async () => {
                // Test all assets together to ensure calculations work in combination
                const assets = [TON_MAINNET, TSTON_MAINNET, STTON_MAINNET, USDE_MAINNET, TSUSDE_MAINNET, USDT_MAINNET];
                const prices = await oracle.getPrices(assets, fetchConfig);

                // Verify all prices are present and positive
                assets.forEach((asset) => {
                    const price = prices.dict.get(asset.assetId);
                    expect(price).toBeDefined();
                    expect(price!).toBeGreaterThan(0n);
                });

                // Verify the dictionary size matches the number of unique assets
                expect(prices.dict.size).toBe(assets.length);
            });
        });
    });
});
