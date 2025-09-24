import { HermesClient, HexString, PriceUpdate } from '@pythnetwork/hermes-client';
import { Dictionary } from '@ton/core';
import { checkNotInDebtAtAll } from '../../api/math';
import { OracleConfig } from '../../api/parsers/PythOracleParser';
import { packPythUpdatesData } from '../../api/prices';
import { ASSET_PRICE_SCALE } from '../../constants/general';
import { FeedMapItem, PoolAssetConfig } from '../../types/Master';
import { FetchConfig, proxyFetchRetries } from '../../utils/utils';
import { TTL_ORACLE_DATA_SEC } from '../constants';
import { PythPrices } from '../prices/PythPrices';
import { PythFeedUpdateType, PythPriceSourcesConfig } from '../Types';
import { AbstractCollector } from './AbstractCollector';

export type PythCollectorConfig = {
    poolAssetsConfig: PoolAssetConfig[];
    pythOracle: OracleConfig;
    pythConfig: PythPriceSourcesConfig;
};

export class PythCollector extends AbstractCollector {
    #parsedFeedsMap = new Map<HexString, FeedMapItem>();
    #pythConfig: PythPriceSourcesConfig;
    #poolAssetsConfig: PoolAssetConfig[];
    #allowedRefTokens: Dictionary<bigint, bigint>;

    #assetToFeeds = new Map<bigint, HexString[]>();

    constructor(config: PythCollectorConfig) {
        super();
        this.#pythConfig = config.pythConfig;
        this.#poolAssetsConfig = config.poolAssetsConfig;

        this.#allowedRefTokens = config.pythOracle.allowedRefTokens;

        for (const [feedId, feedMap] of config.pythOracle.feedsMap) {
            this.#parsedFeedsMap.set(feedId, feedMap);
        }

        for (const [feedId, connectedFeed] of this.#parsedFeedsMap) {
            this.#assetToFeeds.set(connectedFeed.assetId, [feedId, connectedFeed.feedId]);
        }
    }

    async getPricesForLiquidate(
        realPrincipals: Dictionary<bigint, bigint>,
        fetchConfig?: FetchConfig,
    ): Promise<PythPrices> {
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
        supplyAsset: PoolAssetConfig,
        withdrawAsset: PoolAssetConfig,
        collateralToDebt: boolean,
        fetchConfig?: FetchConfig,
    ): Promise<PythPrices> {
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (assets.includes(undefined)) {
            throw new Error('User from another pool');
        }

        if (!assets.find((a) => a?.assetId === supplyAsset.assetId)) {
            assets.push(supplyAsset);
        }

        if (!assets.find((a) => a?.assetId === withdrawAsset.assetId)) {
            assets.push(withdrawAsset);
        }
        if (collateralToDebt && assets.length == 1) {
            throw new Error('Cannot debt only one supplied asset');
        }
        return this.getPrices(
            assets.map((x) => x!),
            fetchConfig,
        );
    }

    async getPrices(
        assets: PoolAssetConfig[] = this.#poolAssetsConfig,
        fetchConfig?: FetchConfig,
    ): Promise<PythPrices> {
        // Declare variables at the beginning
        let minPublishTime: number | undefined;
        let maxPublishTime: number | undefined;

        if (assets.length === 0) {
            return PythPrices.createEmptyPrices();
        }
        const requestedFeeds = new Set<HexString>();
        const requestedRefAssets = new Set<PoolAssetConfig>();

        for (const asset of assets) {
            if (this.#allowedRefTokens.has(asset.assetId)) {
                const refTokenId = this.#allowedRefTokens.get(asset.assetId)!;

                if (this.#assetToFeeds.has(refTokenId)) {
                    const [feedId, refFeedId] = this.#assetToFeeds.get(refTokenId)!;
                    requestedFeeds.add(feedId);

                    if (refFeedId !== '0x0') {
                        requestedFeeds.add(refFeedId);
                    }
                }

                requestedRefAssets.add(asset);
            }

            if (this.#assetToFeeds.has(asset.assetId)) {
                const [feedId, refFeedId] = this.#assetToFeeds.get(asset.assetId)!;
                requestedFeeds.add(feedId);

                if (refFeedId !== '0x0') {
                    requestedFeeds.add(refFeedId);
                }
            }
        }

        const targetFeeds = Array.from(requestedFeeds);
        const refAssets = Array.from(requestedRefAssets);

        const pythUpdates = await this.#fetchPythUpdatesWithRetry(targetFeeds, fetchConfig);

        // Calculate min and max publish times for validation
        if (pythUpdates.parsed && pythUpdates.parsed.length > 0) {
            let tmin = pythUpdates.parsed[0].price.publish_time;
            let tmax = tmin;

            for (let i = 1; i < pythUpdates.parsed.length; i++) {
                const publishTime = pythUpdates.parsed[i].price.publish_time;
                if (publishTime < tmin) tmin = publishTime;
                if (publishTime > tmax) tmax = publishTime;
            }

            if (tmax - tmin > TTL_ORACLE_DATA_SEC) {
                throw new Error(
                    `Price feeds don't fit in a single 3-minute window. Time span: ${tmax - tmin} seconds (max allowed: ${TTL_ORACLE_DATA_SEC})`,
                );
            }

            minPublishTime = tmin;
            maxPublishTime = tmin + TTL_ORACLE_DATA_SEC;
        }

        const pricesDict = Dictionary.empty<bigint, bigint>();
        const pythPriceUpdates = pythUpdates.parsed;

        if (pythPriceUpdates) {
            // Only set prices for requested assets, not all possible mapped assets
            const requestedAssetIds = new Set(assets.map((a) => a.assetId));

            for (const u of pythPriceUpdates) {
                const feedId = `0x${u.id}`;

                const price = (BigInt(u.price.price) * BigInt(10 ** 9)) / BigInt(10 ** (u.price.expo * -1));

                // Find the feed mapping for this feedId and always set the price for the mapped asset
                const feedMapItem = this.#parsedFeedsMap.get(feedId);
                if (feedMapItem) {
                    pricesDict.set(feedMapItem.assetId, price);
                }

                // Handle reference tokens - check if any asset uses this feed as a reference
                for (const asset of assets) {
                    if (this.#allowedRefTokens.has(asset.assetId)) {
                        const refTokenId = this.#allowedRefTokens.get(asset.assetId)!;
                        const refFeeds = this.#assetToFeeds.get(refTokenId);

                        if (refFeeds && (refFeeds[0] === feedId || refFeeds[1] === feedId)) {
                            if (requestedAssetIds.has(asset.assetId)) {
                                // For allowedRefTokens, both asset and reference token should have the same price
                                // Set the same price for both the asset and its reference token
                                pricesDict.set(asset.assetId, price);
                                pricesDict.set(refTokenId, price);
                            }
                        }
                    }
                }
            }

            // Apply dynamic scaling for liquid staking tokens based on feedsMap configuration
            // For each asset that has a feedId (not '0x0'), apply scaling: asset_price = asset_rate * base_price / ASSET_PRICE_SCALE
            for (const [feedId, feedMapItem] of this.#parsedFeedsMap) {
                if (feedMapItem.feedId !== '0x0') {
                    const assetPrice = pricesDict.get(feedMapItem.assetId);
                    const baseFeedMapItem = this.#parsedFeedsMap.get(feedMapItem.feedId);
                    const basePrice = baseFeedMapItem ? pricesDict.get(baseFeedMapItem.assetId) : undefined;

                    if (assetPrice && basePrice) {
                        const scaledPrice = (assetPrice * basePrice) / ASSET_PRICE_SCALE;
                        pricesDict.set(feedMapItem.assetId, scaledPrice);
                    }
                }
            }

            // Apply scaling for reference tokens (allowedRefTokens)
            // For assets that reference other tokens, they should have the SAME price as their reference token
            // This is different from feedsMap scaling where we multiply rates
            for (const asset of assets) {
                if (this.#allowedRefTokens.has(asset.assetId)) {
                    const refTokenId = this.#allowedRefTokens.get(asset.assetId)!;
                    const refTokenPrice = pricesDict.get(refTokenId);

                    if (refTokenPrice && requestedAssetIds.has(asset.assetId)) {
                        // For allowedRefTokens, the asset price should equal the reference token price
                        pricesDict.set(asset.assetId, refTokenPrice);
                    }
                }
            }

            // Check that all requested assets have prices
            const missing = assets.map((a) => a.assetId).filter((id) => pricesDict.get(id) === undefined);

            if (missing.length) {
                throw new Error(
                    `Missing prices for ${missing.length} asset(s): ${missing.map((x) => x.toString()).join(', ')}`,
                );
            }

            const dataCell = packPythUpdatesData(pythUpdates.binary);

            return new PythPrices({
                dict: pricesDict,
                dataCell,
                minPublishTime,
                maxPublishTime,
                refAssets,
                targetFeeds,
                binaryUpdate: pythUpdates.binary,
            });
        }
        return PythPrices.createEmptyPrices();
    }

    async getPricesForWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        withdrawAsset: PoolAssetConfig,
        collateralToDebt = false,
        fetchConfig?: FetchConfig,
    ): Promise<PythPrices> {
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (
            checkNotInDebtAtAll(realPrincipals) &&
            (realPrincipals.get(withdrawAsset.assetId) ?? 0n) > 0n &&
            !collateralToDebt
        ) {
            return PythPrices.createEmptyPrices();
        }
        if (assets.includes(undefined)) {
            throw new Error('User from another pool');
        }
        if (!assets.includes(withdrawAsset)) {
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
        fetchConfig?: FetchConfig,
    ): Promise<PythFeedUpdateType> {
        return proxyFetchRetries(this.#getPythFeedsUpdates(requiredFeeds), fetchConfig);
    }

    /**
     * Creates a list of required feed IDs for the given assets
     * @param assets - Array of pool asset configurations
     * @returns Array of unique feed IDs required for the assets
     */
    createRequiredFeedsList(assets: PoolAssetConfig[]): HexString[] {
        const requestedFeeds = new Set<HexString>();

        for (const asset of assets) {
            const addFeedsForAsset = (assetId: bigint) => {
                if (this.#assetToFeeds.has(assetId)) {
                    const [feedId, refFeedId] = this.#assetToFeeds.get(assetId)!;
                    requestedFeeds.add(feedId);

                    if (refFeedId !== '0x0') {
                        requestedFeeds.add(refFeedId);
                    }
                }
            };

            if (this.#allowedRefTokens.has(asset.assetId)) {
                const refTokenId = this.#allowedRefTokens.get(asset.assetId)!;
                addFeedsForAsset(refTokenId);
            }

            addFeedsForAsset(asset.assetId);
        }

        return Array.from(requestedFeeds);
    }

    // public createRequiredFeedsList(assets: PoolAssetConfig[]): HexString[] {
    //     const requiredFeeds = new Set<bigint>();

    //     for (const asset of assets) {
    //         let pythId = this.#evaaToPythDirect.get(asset.assetId);

    //         // If assetId no have native feed — try by allowedRefTokens (evAA->baseEvAA->pyth)
    //         if (!pythId) {
    //             const baseEvaa = this.#allowedRefEvaa.get(asset.assetId);
    //             if (baseEvaa) pythId = this.#evaaToPythDirect.get(baseEvaa) ?? null!;
    //         }

    //         if (pythId) {
    //             requiredFeeds.add(pythId);
    //             const feedInfo = this.#parsedFeedsMap.get(pythId);
    //             if (feedInfo?.feedId && feedInfo.feedId !== 0n) {
    //                 requiredFeeds.add(feedInfo.feedId);
    //             }
    //         }
    //     }

    //     return Array.from(requiredFeeds).map((id) => '0x' + id.toString(16));
    // }

    #filterEmptyPrincipalsAndAssets(principals: Dictionary<bigint, bigint>) {
        return principals
            .keys()
            .filter((x) => principals.get(x)! != 0n)
            .map((x) => this.#poolAssetsConfig.find((asset) => asset.assetId == x));
    }
}
