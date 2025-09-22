import { HermesClient, HexString, PriceUpdate } from '@pythnetwork/hermes-client';
import { Dictionary } from '@ton/core';
import { checkNotInDebtAtAll } from '../../api/math';
import { OracleConfig } from '../../api/parsers/PythOracleParser';
import { packPythUpdatesData } from '../../api/prices';
import { STTON_MAINNET, TON_MAINNET, TSTON_MAINNET, TSUSDE_MAINNET, USDE_MAINNET } from '../../constants';
import { FeedMapItem, parseFeedsMapDict, PoolAssetConfig } from '../../types/Master';
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
    #oracleInfo: OracleConfig;
    #parsedFeedsMap: Map<bigint, FeedMapItem>;
    #pythConfig: PythPriceSourcesConfig;
    #poolAssetsConfig: PoolAssetConfig[];

    #pythToEvaaDirect = new Map<bigint, bigint>(); // pythId -> evaaId (native)
    #pythToEvaaReferred = new Map<bigint, Set<bigint>>(); // pythId -> Set<evaaId>,
    #evaaToPythDirect = new Map<bigint, bigint>(); // evaaId -> pythId (native)
    #allowedRefEvaa = new Map<bigint, bigint>(); // evaaId -> baseEvaaId (allowedRefTokens)

    constructor(config: PythCollectorConfig) {
        super();
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
        supplyAsset: PoolAssetConfig | undefined,
        withdrawAsset: PoolAssetConfig | undefined,
        collateralToDebt: boolean,
        fetchConfig?: FetchConfig,
    ): Promise<PythPrices> {
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (assets.includes(undefined)) {
            throw new Error('User from another pool');
        }

        if (supplyAsset && !assets.find((a) => a?.assetId === supplyAsset.assetId)) {
            assets.push(supplyAsset);
        }

        if (withdrawAsset && !assets.find((a) => a?.assetId === withdrawAsset.assetId)) {
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

        const requiredFeeds = this.createRequiredFeedsList(assets);
        const pythUpdates = await this.#fetchPythUpdatesWithRetry(requiredFeeds, fetchConfig);

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
                const pythId = BigInt('0x' + u.id);

                const price = (BigInt(u.price.price) * BigInt(10 ** 9)) / BigInt(10 ** (u.price.expo * -1));

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

            // TODO: fix it

            if (pricesDict.get(TSTON_MAINNET.assetId) && pricesDict.get(TON_MAINNET.assetId)) {
                pricesDict.set(
                    TSTON_MAINNET.assetId,
                    (pricesDict.get(TSTON_MAINNET.assetId)! * pricesDict.get(TON_MAINNET.assetId)!) / BigInt(10 ** 9),
                );
            }

            // TODO: fix it
            if (pricesDict.get(STTON_MAINNET.assetId) && pricesDict.get(TON_MAINNET.assetId)) {
                pricesDict.set(
                    STTON_MAINNET.assetId,
                    (pricesDict.get(STTON_MAINNET.assetId)! * pricesDict.get(TON_MAINNET.assetId)!) / BigInt(10 ** 9),
                );
            }

            // TODO: fix it
            if (pricesDict.get(TSUSDE_MAINNET.assetId) && pricesDict.get(USDE_MAINNET.assetId)) {
                pricesDict.set(
                    TSUSDE_MAINNET.assetId,
                    (pricesDict.get(TSUSDE_MAINNET.assetId)! * pricesDict.get(USDE_MAINNET.assetId)!) / BigInt(10 ** 9),
                );
            }

            // Check that all requested assets have prices
            const missing = assets.map((a) => a.assetId).filter((id) => pricesDict.get(id) === undefined);

            if (missing.length) {
                throw new Error(
                    `Missing prices for ${missing.length} asset(s): ${missing.map((x) => x.toString()).join(', ')}`,
                );
            }

            const dataCell = packPythUpdatesData(pythUpdates.binary);

            // Filter assets to only include reference tokens
            const refTokens = assets.filter((asset) => {
                const assetId = asset.assetId;
                // Check if asset is a referred token (uses referredPythFeed)
                const feedInfo = Array.from(this.#parsedFeedsMap.values()).find((f) => f.evaaId === assetId);
                const isReferredToken = feedInfo && feedInfo.referredPythFeed && feedInfo.referredPythFeed !== 0n;

                // Check if asset is an allowed reference token
                const isAllowedRefToken = this.#allowedRefEvaa.has(assetId);

                return isReferredToken || isAllowedRefToken;
            });

            return new PythPrices({
                dict: pricesDict,
                dataCell,
                minPublishTime,
                maxPublishTime,
                requestedRefTokens: refTokens,
                targetFeeds: requiredFeeds,
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

    public createRequiredFeedsList(assets: PoolAssetConfig[]): HexString[] {
        const requiredFeeds = new Set<bigint>();

        for (const asset of assets) {
            let pythId = this.#evaaToPythDirect.get(asset.assetId);

            // If evaaId no have native feed — try by allowedRefTokens (evAA->baseEvAA->pyth)
            if (!pythId) {
                const baseEvaa = this.#allowedRefEvaa.get(asset.assetId);
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
