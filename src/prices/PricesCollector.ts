import { Cell, Dictionary } from "@ton/core";
import { MAINNET_POOL_CONFIG } from "../constants/pools";
import { PoolAssetConfig, PoolAssetsConfig, PoolConfig } from "../types/Master";
import { PriceSource } from "./sources";
import { DefaultPriceSourcesConfig, PriceSourcesConfig, RawPriceData } from "./Types";
import { collectAndFilterPrices, generatePriceSources, getMedianPrice, packAssetsData, packOraclesData, packPrices, verifyPricesSign, verifyPricesTimestamp } from "./utils";
import { delay } from "../utils/utils";
import { Prices } from "./Prices";
import { checkNotInDebtAtAll } from "../api/math";


export class PricesCollector {
    #prices: RawPriceData[];
    #poolConfig: PoolConfig;
    #sourcesConfig: PriceSourcesConfig;
    #priceSources: PriceSource[];

    constructor(poolConfig: PoolConfig = MAINNET_POOL_CONFIG, sourcesConfig: PriceSourcesConfig = DefaultPriceSourcesConfig, additionalPriceSources?: PriceSource[]) {
        this.#poolConfig = poolConfig;
        this.#sourcesConfig = sourcesConfig;
        this.#priceSources = generatePriceSources(this.#sourcesConfig, this.#poolConfig.oracles);

        if (additionalPriceSources) {
            this.#priceSources.push(...additionalPriceSources);
        }

        this.#prices = [];
    }

    // TODO Make UserData class and incapsulate raw bigintegers

    async getPricesForLiquidate(userPrincipals: Dictionary<bigint, bigint>, retries: number = 1, timeout: number = 3000): Promise<Prices>  {
        const assets = userPrincipals.keys().map(x => this.#poolConfig.poolAssetsConfig.find(asset => asset.assetId == x));
        if (assets.includes(undefined)) {
            throw new Error("User from another pool");
        }
        return await this.getPrices(assets.map(x => x!), retries, timeout);
    }


    async getPricesForWithdraw(userPrincipals: Dictionary<bigint, bigint>, withdrawAsset: PoolAssetConfig, collateralToDebt = false, retries: number = 1, timeout: number = 3000): Promise<Prices>  {
        let assets = userPrincipals.keys().map(x => this.#poolConfig.poolAssetsConfig.find(asset => asset.assetId == x));
        if (checkNotInDebtAtAll(userPrincipals) && userPrincipals.has(withdrawAsset.assetId) && !collateralToDebt) {
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

        return await this.getPrices(assets.map(x => x!), retries, timeout);
    }

    async getPrices(assets: PoolAssetsConfig = this.#poolConfig.poolAssetsConfig, retries: number = 1, timeout: number = 3000): Promise<Prices> {
        console.debug('[getPrices] Assets length', assets.length);

        if (assets.length == 0) {
            return new Prices(Dictionary.empty<bigint, bigint>(), Cell.EMPTY);
        }

        for (let i = 0; i <= retries; i++) {  // attemts = retries + 1
            if (!this.#prices || this.#filterPrices() < this.#poolConfig.minimalOracles) {
                //console.debug('[getPrices] Load prices attemp', i + 1)
                if (i > 0) {
                    await delay(timeout);
                }
                await this.#collectPrices();
            } else {
                break;
            }
        }

        if (this.#prices.length < this.#poolConfig.minimalOracles) {
            throw new Error(`Error per updating prices, valid ${this.#prices.length} of ${this.#poolConfig.minimalOracles}`);  // if still not enough data after retries
        }
        const prices = this.#getPricesByAssetList(assets);
        return new Prices(prices.dict, prices.dataCell);
    }

    #getPricesByAssetList(assets: PoolAssetsConfig) {
        //console.debug('[getPricesByAssetList] start')
        let pricesFiltered = this.#prices;  // for strict check this.#prices.filter(x => assets.every(asset => x.dict.has(asset.assetId)));

        if (pricesFiltered.length < this.#poolConfig.minimalOracles) {
            throw new Error("Not enough price data");
        }

        if (pricesFiltered.length > this.#poolConfig.minimalOracles) {
            const sortedByTimestamp = pricesFiltered.slice().sort((a, b) => b.timestamp - a.timestamp);
            const newerPrices = sortedByTimestamp.slice(0, this.#poolConfig.minimalOracles);
            pricesFiltered = newerPrices.sort((a, b) => a.oracleId - b.oracleId);
        }

        const medianData = assets.map(asset => ({ assetId: asset.assetId, medianPrice: getMedianPrice(this.#prices, asset.assetId)}));

        const nonEmptymedianData = medianData.filter(x => x.medianPrice != null) as { assetId: bigint, medianPrice: bigint }[];

        const packedMedianData = packAssetsData(nonEmptymedianData);

        const oraclesData = this.#prices.map(x => ({oracle: {id: x.oracleId, pubkey: x.pubkey}, data: {timestamp: x.timestamp, prices: x.dict}, signature: x.signature}));
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
            this.#prices = await Promise.any(this.#priceSources.map(x => collectAndFilterPrices(x, this.#poolConfig)));
            return true;
        }
        catch { }
        return false;
    }

    #filterPrices(): number {  // filter again for expire check
        this.#prices = this.#prices.filter(verifyPricesTimestamp());
        return this.#prices.length;
    }
}
