import { HermesClient, HexString, PriceUpdate } from '@pythnetwork/hermes-client';
import { Cell, Dictionary } from '@ton/core';
import { checkNotInDebtAtAll } from '../api/math';
import { OracleConfig } from '../api/parsers/PythOracleParser';
import { packPythUpdatesData } from '../api/prices';
import { FeedMapItem, parseFeedsMapDict, PoolAssetConfig, PoolAssetsConfig } from '../types/Master';
import { FetchConfig, proxyFetchRetries } from '../utils/utils';
import { Oracle } from './Oracle.interface';
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

    #pythToEvaaDirect = new Map<bigint, bigint>(); // pythId -> evaaId (native)
    #pythToEvaaReferred = new Map<bigint, Set<bigint>>(); // pythId -> Set<evaaId>,
    #evaaToPythDirect = new Map<bigint, bigint>(); // evaaId -> pythId (native)
    #allowedRefEvaa = new Map<bigint, bigint>(); // evaaId -> baseEvaaId (allowedRefTokens)

    constructor(config: PythCollectorConfig) {
        this.#oracleInfo = config.pythOracle;
        this.#pythConfig = config.pythConfig;
        this.#poolAssetsConfig = config.poolAssetsConfig;
        this.#parsedFeedsMap = parseFeedsMapDict(this.#oracleInfo.feedsMap);

        // 1) pythId -> evaaId, evaaId -> pythId
        for (const [pythId, feedInfo] of this.#parsedFeedsMap.entries()) {
            this.#pythToEvaaDirect.set(pythId, feedInfo.evaaId);
            this.#evaaToPythDirect.set(feedInfo.evaaId, pythId);
        }

        // 2) pythId (native) -> Set<evaaId>
        for (const [pythId, feedInfo] of this.#parsedFeedsMap.entries()) {
            const ref = feedInfo.referredPythFeed;
            if (ref && ref !== 0n) {
                if (!this.#pythToEvaaReferred.has(ref)) this.#pythToEvaaReferred.set(ref, new Set());
                this.#pythToEvaaReferred.get(ref)!.add(feedInfo.evaaId);
            }
        }

        // 3)  evaaId -> baseEvaaId (allowedRefTokens)
        for (const evaaId of this.#oracleInfo.allowedRefTokens.keys()) {
            const base = this.#oracleInfo.allowedRefTokens.get(evaaId)!;
            this.#allowedRefEvaa.set(evaaId, base);

            // If baseEvaaId have pythId. evaaId -> pyth(base)
            const basePyth = this.#evaaToPythDirect.get(base);
            if (basePyth) {
                if (!this.#pythToEvaaReferred.has(basePyth)) this.#pythToEvaaReferred.set(basePyth, new Set());
                this.#pythToEvaaReferred.get(basePyth)!.add(evaaId);
            }
        }
    }

    async getPricesForLiquidate(
        realPrincipals: Dictionary<bigint, bigint>,
        fetchConfig?: FetchConfig,
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
        fetchConfig?: FetchConfig,
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

    async getPrices(assets: PoolAssetsConfig, fetchConfig?: FetchConfig): Promise<Prices> {
        if (assets.length === 0) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }

        const requiredFeeds = this.createRequiredFeedsList(assets.map((a) => a.assetId));
        const pythUpdates = await this.#fetchPythUpdatesWithRetry(requiredFeeds, fetchConfig);

        const pricesDict = Dictionary.empty<bigint, bigint>();
        const pythPriceUpdates = pythUpdates.parsed;

        if (pythPriceUpdates) {
            // Only set prices for requested assets, not all possible mapped assets
            const requestedAssetIds = new Set(assets.map((a) => a.assetId));

            for (const u of pythPriceUpdates) {
                const pythId = BigInt('0x' + u.id);
                const price = BigInt(u.price.price);

                // Set price for direct mapping if the evaaId is requested
                const directEvaa = this.#pythToEvaaDirect.get(pythId);
                if (directEvaa && requestedAssetIds.has(directEvaa)) {
                    pricesDict.set(directEvaa, price);
                }

                // Set price for referred assets only if they are requested
                const referredSet = this.#pythToEvaaReferred.get(pythId);
                if (referredSet && referredSet.size) {
                    for (const evaaId of referredSet) {
                        if (requestedAssetIds.has(evaaId)) {
                            pricesDict.set(evaaId, price);
                        }
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
        fetchConfig?: FetchConfig,
    ): Promise<PythFeedUpdateType> {
        return proxyFetchRetries(this.#getPythFeedsUpdates(requiredFeeds), fetchConfig);
    }

    public createRequiredFeedsList(evaaIds: bigint[]): HexString[] {
        const requiredFeeds = new Set<bigint>();

        for (const evaaId of evaaIds) {
            let pythId = this.#evaaToPythDirect.get(evaaId);

            // If evaaId no have native feed — try by allowedRefTokens (evAA->baseEvAA->pyth)
            if (!pythId) {
                const baseEvaa = this.#allowedRefEvaa.get(evaaId);
                if (baseEvaa) pythId = this.#evaaToPythDirect.get(baseEvaa) ?? null!;
            }

            if (pythId) {
                requiredFeeds.add(pythId);
                const feedInfo = this.#parsedFeedsMap.get(pythId);
                if (feedInfo?.referredPythFeed && feedInfo.referredPythFeed !== 0n) {
                    requiredFeeds.add(feedInfo.referredPythFeed);
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
