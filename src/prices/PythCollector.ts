import { HermesClient, HexString, PriceUpdate } from '@pythnetwork/hermes-client';
import { Cell, Dictionary } from '@ton/core';
import { checkNotInDebtAtAll } from '../api/math';
import { packPythUpdatesData } from '../api/prices';
import { FeedMapItem, OracleConfig, parseFeedsMapDict, PoolAssetConfig, PoolAssetsConfig } from '../types/Master';
import { FetchPricesConfig, Oracle } from './Oracle.interface';
import { Prices } from './Prices';
import { PythFeedUpdateType, PythPriceSourcesConfig } from './Types';

export type PythCollectorConfig = {
    poolAssetsConfig: PoolAssetsConfig;
    pythOracle: OracleConfig;
    pythConfig: PythPriceSourcesConfig;
};

export class PythCollector implements Oracle {
    #oracleInfo: OracleConfig;
    #parsedFeedsMap: Map<bigint, FeedMapItem>;
    #pythConfig: PythPriceSourcesConfig;
    #poolAssetsConfig: PoolAssetsConfig;

    constructor(config: PythCollectorConfig) {
        this.#oracleInfo = config.pythOracle;
        this.#pythConfig = config.pythConfig;
        this.#poolAssetsConfig = config.poolAssetsConfig;
        this.#parsedFeedsMap = parseFeedsMapDict(this.#oracleInfo.feedsMap);
    }

    async getPricesForLiquidate(
        realPrincipals: Dictionary<bigint, bigint>,
        fetchConfig: FetchPricesConfig,
    ): Promise<Prices> {
        const assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (assets.includes(undefined)) {
            throw new Error('User from another pool');
        }
        return await this.getPrices(
            assets.map((x) => x!),
            fetchConfig,
        );
    }

    async getPricesForSupplyWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        supplyAsset: PoolAssetConfig | undefined,
        withdrawAsset: PoolAssetConfig | undefined,
        collateralToDebt: boolean,
        fetchConfig: FetchPricesConfig,
    ): Promise<Prices> {
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (
            checkNotInDebtAtAll(realPrincipals) &&
            withdrawAsset &&
            (realPrincipals.get(withdrawAsset.assetId) ?? 0n) > 0n &&
            !collateralToDebt
        ) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }
        if (assets.includes(undefined)) {
            throw new Error('User from another pool');
        }
        if (withdrawAsset && !assets.find((a) => a?.assetId === withdrawAsset.assetId)) {
            assets.push(withdrawAsset);
        }
        if (collateralToDebt && assets.length == 1) {
            throw new Error('Cannot debt only one supplied asset');
        }
        return await this.getPrices(
            assets.map((x) => x!),
            fetchConfig,
        );
    }

    async getPrices(assets: PoolAssetsConfig, fetchConfig: FetchPricesConfig): Promise<Prices> {
        if (assets.length === 0) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }

        const requiredFeeds = this.createRequiredFeedsList(assets.map((a) => a.assetId));
        const pythUpdates = await this.#fetchPythUpdatesWithRetry(requiredFeeds, fetchConfig);

        const pricesDict = Dictionary.empty<bigint, bigint>();
        const pythPriceUpdates = pythUpdates.parsed;

        if (pythPriceUpdates) {
            for (const priceUpdate of pythPriceUpdates) {
                const price = BigInt(priceUpdate.price.price);
                const conf = BigInt(priceUpdate.price.conf);

                // Find evaaId for this pyth feed
                const pythId = BigInt('0x' + priceUpdate.id);
                const feedInfo = this.#parsedFeedsMap.get(pythId);
                if (feedInfo) {
                    pricesDict.set(feedInfo.evaaId, price);
                }
            }
            const dataCell = packPythUpdatesData(pythUpdates.binary);

            return new Prices(pricesDict, dataCell);
        }
        return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
    }

    /**
     * Updates feeds data from specified endpoint
     * @param feedIds list of pyth feed ids to fetch
     * @returns binary - buffer of feeds update, parsed - json feeds data
     */
    async #getPythFeedsUpdates(feedIds: HexString[]): Promise<PythFeedUpdateType> {
        const latestPriceUpdates: PriceUpdate = await Promise.any(
            this.#pythConfig.pythEndpoints.map((x) =>
                new HermesClient(x).getLatestPriceUpdates(feedIds, { encoding: 'hex' }),
            ),
        );

        const parsed = latestPriceUpdates['parsed'];
        const binary = Buffer.from(latestPriceUpdates.binary.data[0], 'hex');

        return { binary, parsed };
    }

    async #fetchPythUpdatesWithRetry(
        requiredFeeds: HexString[],
        fetchConfig: FetchPricesConfig,
    ): Promise<PythFeedUpdateType> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= fetchConfig.retries; attempt++) {
            try {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout')), fetchConfig.timeout);
                });

                const fetchPromise = this.#getPythFeedsUpdates(requiredFeeds);
                return await Promise.race([fetchPromise, timeoutPromise]);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < fetchConfig.retries) {
                    // Exponential backoff: wait 1s, 2s, 4s, etc.
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw new Error(
            `Failed to fetch Pyth updates after ${fetchConfig.retries + 1} attempts. Last error: ${lastError?.message}`,
        );
    }

    public createRequiredFeedsList(evaaIds: bigint[]): HexString[] {
        const requiredFeeds = new Set<bigint>();
        const queue = [...evaaIds];

        const evaaToPythMap = new Map<bigint, bigint>();
        for (const [pythId, feedInfo] of this.#parsedFeedsMap.entries()) {
            evaaToPythMap.set(feedInfo.evaaId, pythId);
        }

        while (queue.length > 0) {
            const evaaId = queue.shift();
            if (!evaaId) continue;

            const pythId = evaaToPythMap.get(evaaId);
            if (pythId && !requiredFeeds.has(pythId)) {
                requiredFeeds.add(pythId);
                const feedInfo = this.#parsedFeedsMap.get(pythId);
                if (feedInfo && feedInfo.referredPythFeed !== 0n) {
                    const referredPythId = feedInfo.referredPythFeed;
                    if (!requiredFeeds.has(referredPythId)) {
                        requiredFeeds.add(referredPythId);
                    }
                }
            }
        }

        return Array.from(requiredFeeds).map((id) => '0x' + id.toString(16));
    }

    #filterEmptyPrincipalsAndAssets(principals: Dictionary<bigint, bigint>) {
        return principals
            .keys()
            .filter((x) => principals.get(x)! != 0n)
            .map((x) => this.#poolAssetsConfig.find((asset) => asset.assetId == x));
    }
}
