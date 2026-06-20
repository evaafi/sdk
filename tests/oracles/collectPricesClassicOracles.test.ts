import { Cell } from '@ton/core';
import { ClassicCollector, DefaultPriceSourcesConfig, MAINNET_POOL_ASSETS_CONFIG } from '../../src';
import { ORACLES_MAINNET } from '../../src/constants/general';
import { PriceSourcesConfig } from '../../src/oracles/Types';
import { FetchConfig } from '../../src/utils/utils';

const MIN_ORACLES = 3;
const FAST_FETCH: FetchConfig = { retries: 0, timeout: 1500 };

describe('ClassicCollector.#collectPricesWithValidation (integration)', () => {
    test('falls back from an invalid endpoint to a working production source', async () => {
        const sources: PriceSourcesConfig = {
            backendEndpoints: ['invalid.evaa.space', ...DefaultPriceSourcesConfig.backendEndpoints],
            icpEndpoints: DefaultPriceSourcesConfig.icpEndpoints,
        };

        const collector = new ClassicCollector({
            poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
            minimalOracles: MIN_ORACLES,
            evaaOracles: ORACLES_MAINNET,
            sourcesConfig: sources,
        });

        const prices = await collector.getPrices(undefined, FAST_FETCH);

        expect(prices.dict.values().length).toBeGreaterThan(0);
        expect(prices.dataCell).not.toEqual(Cell.EMPTY);
    });

    test('throws when all production sources are unavailable', async () => {
        const sources: PriceSourcesConfig = {
            backendEndpoints: ['invalid.evaa.space'],
            icpEndpoints: ['invalid.raw.icp0.io'],
        };

        const collector = new ClassicCollector({
            poolAssetsConfig: MAINNET_POOL_ASSETS_CONFIG,
            minimalOracles: MIN_ORACLES,
            evaaOracles: ORACLES_MAINNET,
            sourcesConfig: sources,
        });

        await expect(collector.getPrices(undefined, { retries: 0, timeout: 1000 })).rejects.toThrow(
            /Failed to collect sufficient prices/,
        );
    });
});
