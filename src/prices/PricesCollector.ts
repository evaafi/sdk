import { Cell, Dictionary } from "@ton/core"
import { checkNotInDebtAtAll } from "../api/math"
import { ExtendedEvaaOracle, PoolAssetConfig, PoolAssetsConfig } from "../types/Master"
import { FetchConfig, proxyFetchRetries } from '../utils/utils'
import { Oracle } from "./Oracle.interface"
import { Prices } from "./Prices"
import { PriceSource } from "./sources"
import { DefaultPriceSourcesConfig, PriceSourcesConfig, RawPriceData } from "./Types"
import { collectAndFilterPrices, generatePriceSources, getMedianPrice, packAssetsData, packOraclesData, packPrices, verifyPricesTimestamp } from "./utils"


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

    async getPricesForLiquidate(realPrincipals: Dictionary<bigint, bigint>, fetchConfig?: FetchConfig): Promise<Prices>  {
        const assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (assets.includes(undefined)) {
            throw new Error("User from another pool");
        }
        return await this.getPrices(assets.map(x => x!), fetchConfig);
    }

    async getPricesForWithdraw(realPrincipals: Dictionary<bigint, bigint>, withdrawAsset: PoolAssetConfig, collateralToDebt = false, fetchConfig?: FetchConfig): Promise<Prices>  {
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
        fetchConfig?: FetchConfig,
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

    async getPrices(assets: PoolAssetsConfig = this.#poolAssetsConfig, fetchConfig?: FetchConfig): Promise<Prices> {
        if (assets.length == 0) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }

        await this.#collectPricesWithValidation(fetchConfig);

        if (this.#prices.length < this.#minimalOracles) {
            throw new Error(`Error per updating prices, valid ${this.#prices.length} of ${this.#minimalOracles}`);
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

    async #collectPrices(fetchConfig?: FetchConfig): Promise<boolean> {
        for (const priceSource of this.#priceSources) {
            try {
                this.#prices = await proxyFetchRetries(
                    collectAndFilterPrices(priceSource, this.#minimalOracles, fetchConfig),
                    fetchConfig,
                );
                return true;
            } catch (error) {
                // Try next source
                continue;
            }
        }

        return false;
    }

    async #collectPricesWithValidation(fetchConfig?: FetchConfig): Promise<void> {
        if (!this.#prices || this.#filterPrices() < this.#minimalOracles) {
            const success = await this.#collectPrices(fetchConfig);
            if (!success || this.#prices.length < this.#minimalOracles) {
                throw new Error(
                    `Failed to collect sufficient prices: ${this.#prices?.length || 0} of ${this.#minimalOracles}`,
                );
            }
        }
    }

    #filterPrices(): number {
        this.#prices = this.#prices.filter(verifyPricesTimestamp());
        return this.#prices.length;
    }

    #filterEmptyPrincipalsAndAssets(principals: Dictionary<bigint, bigint>) {
        return principals.keys().filter(x => principals.get(x)! != 0n).map(x => this.#poolAssetsConfig.find(asset => asset.assetId == x));
    }
}
