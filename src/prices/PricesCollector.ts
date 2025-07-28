import { Cell, Dictionary } from "@ton/core";
import { MAINNET_POOL_CONFIG } from "../constants/pools";
import { EvaaOracle, ExtendedEvaaOracle, PoolAssetConfig, PoolAssetsConfig, PoolConfig } from "../types/Master";
import { PriceSource } from "./sources";
import { DefaultPriceSourcesConfig, PriceSourcesConfig, RawPriceData } from "./Types";
import { collectAndFilterPrices, generatePriceSources, getMedianPrice, packAssetsData, packOraclesData, packPrices, verifyPricesTimestamp } from "./utils";
import { delay } from "../utils/utils";
import { Prices } from "./Prices";
import { checkNotInDebtAtAll } from "../api/math";
import { FetchPricesConfig, Oracle } from "./Oracle.interface";


export type PricesCollectorConfig = {
    poolAssetsConfig: PoolAssetsConfig;
    minimalOracles: number;
    evaaOracles: ExtendedEvaaOracle[];
    sourcesConfig?: PriceSourcesConfig;
    additionalPriceSources?: PriceSource[];
};

export class PricesCollector implements Oracle {
    #prices: RawPriceData[];
    #poolAssetsConfig: PoolAssetsConfig;
    #sourcesConfig: PriceSourcesConfig;
    #priceSources: PriceSource[];
    #minimalOracles: number;

    constructor(config: PricesCollectorConfig) {
        this.#poolAssetsConfig = config.poolAssetsConfig;
        this.#sourcesConfig = config.sourcesConfig ?? DefaultPriceSourcesConfig;
        this.#priceSources = generatePriceSources(this.#sourcesConfig, config.evaaOracles);
        this.#minimalOracles = config.minimalOracles;
        if (config.additionalPriceSources) {
            this.#priceSources.push(...config.additionalPriceSources);
        }
        this.#prices = [];
    }

    async getPricesForLiquidate(realPrincipals: Dictionary<bigint, bigint>, fetchConfig: FetchPricesConfig): Promise<Prices>  {
        const assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (assets.includes(undefined)) {
            throw new Error("User from another pool");
        }
        return await this.getPrices(assets.map(x => x!), fetchConfig);
    }

    async getPricesForWithdraw(realPrincipals: Dictionary<bigint, bigint>, withdrawAsset: PoolAssetConfig, collateralToDebt = false, fetchConfig: FetchPricesConfig): Promise<Prices>  {
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (checkNotInDebtAtAll(realPrincipals) && (realPrincipals.get(withdrawAsset.assetId) ?? 0n) > 0n && !collateralToDebt) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }
        if (assets.includes(undefined)) {
            throw new Error("User from another pool");
        }
        if (!assets.includes(withdrawAsset)) {
            assets.push(withdrawAsset);
        }
        if (collateralToDebt && assets.length == 1) {
            throw new Error("Cannot debt only one supplied asset");
        }
        return await this.getPrices(assets.map(x => x!), fetchConfig);
    }

    async getPricesForSupplyWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        supplyAsset: PoolAssetConfig | undefined,
        withdrawAsset: PoolAssetConfig | undefined,
        collateralToDebt: boolean,
        fetchConfig: FetchPricesConfig
    ): Promise<Prices> {
        // Используем ту же логику, что и getPricesForWithdraw, но supplyAsset не используется
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (checkNotInDebtAtAll(realPrincipals) && withdrawAsset && (realPrincipals.get(withdrawAsset.assetId) ?? 0n) > 0n && !collateralToDebt) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }
        if (assets.includes(undefined)) {
            throw new Error("User from another pool");
        }
        if (withdrawAsset && !assets.includes(withdrawAsset)) {
            assets.push(withdrawAsset);
        }
        if (collateralToDebt && assets.length == 1) {
            throw new Error("Cannot debt only one supplied asset");
        }
        return await this.getPrices(assets.map(x => x!), fetchConfig);
    }

    async getPrices(assets: PoolAssetsConfig = this.#poolAssetsConfig, fetchConfig: FetchPricesConfig): Promise<Prices> {
        console.debug('[getPrices] Assets length', assets.length);
        if (assets.length == 0) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }
        for (let i = 0; i <= fetchConfig.retries; i++) {  // attemts = retries + 1
            if (!this.#prices || this.#filterPrices() < this.#minimalOracles) {
                if (i > 0) {
                    await delay(fetchConfig.timeout);
                }
                await this.#collectPrices();
            } else {
                break;
            }
        }
        if (this.#prices.length < this.#minimalOracles) {
            throw new Error(`Error per updating prices, valid ${this.#prices.length} of ${this.#minimalOracles}`);  // if still not enough data after retries
        }
        const prices = this.#getPricesByAssetList(assets);
        return new Prices(prices.dict, prices.dataCell);
    }

    #getPricesByAssetList(assets: PoolAssetsConfig) {
        let pricesFiltered = this.#prices;
        if (pricesFiltered.length < this.#minimalOracles) {
            throw new Error("Not enough price data");
        }
        if (pricesFiltered.length > this.#minimalOracles) {
            const sortedByTimestamp = pricesFiltered.slice().sort((a, b) => b.timestamp - a.timestamp);
            const newerPrices = sortedByTimestamp.slice(0, this.#minimalOracles);
            pricesFiltered = newerPrices.sort((a, b) => a.oracleId - b.oracleId);
        }
        const medianData = assets.map((asset) => ({
            assetId: asset.assetId,
            medianPrice: getMedianPrice(pricesFiltered, asset.assetId),
        }));
        const nonEmptymedianData = medianData.filter(x => x.medianPrice != null) as { assetId: bigint, medianPrice: bigint }[];
        const packedMedianData = packAssetsData(nonEmptymedianData);
        const oraclesData = pricesFiltered.map((x) => ({
            oracle: { id: x.oracleId, pubkey: x.pubkey },
            data: { timestamp: x.timestamp, prices: x.dict },
            signature: x.signature,
        }));
        const packedOracleData = packOraclesData(oraclesData, nonEmptymedianData.map(x => x.assetId));
        const dict = Dictionary.empty<bigint, bigint>();
        for (const medianDataAsset of nonEmptymedianData) {
            dict.set(medianDataAsset.assetId, medianDataAsset.medianPrice);
        }
        return {
            dict: dict,
            dataCell: packPrices(packedMedianData, packedOracleData)
        }
    }

    async #collectPrices(): Promise<boolean> {
        try {
            // collectAndFilterPrices теперь требует poolAssetsConfig и minimalOracles
            this.#prices = await Promise.any(this.#priceSources.map(x => collectAndFilterPrices(x, this.#minimalOracles )));
            return true;
        }
        catch { }
        return false;
    }

    #filterPrices(): number {
        this.#prices = this.#prices.filter(verifyPricesTimestamp());
        return this.#prices.length;
    }

    #filterEmptyPrincipalsAndAssets(principals: Dictionary<bigint, bigint>) {
        return principals.keys().filter(x => principals.get(x)! != 0n).map(x => this.#poolAssetsConfig.find(asset => asset.assetId == x));
    }
}
