import { Dictionary } from '@ton/core';
import { checkNotInDebtAtAll } from '../../api/math';
import { ExtendedEvaaOracle, PoolAssetConfig } from '../../types/Master';
import { FetchConfig, proxyFetchRetries } from '../../utils/utils';
import { ClassicPrices, ClassicPricesMode, ClassicPricesOffset } from '../prices/ClassicPrices';
import { PriceSource } from '../sources';
import { DefaultPriceSourcesConfig, PriceSourcesConfig, RawPriceData } from '../Types';
import {
    collectAndFilterPrices,
    generatePriceSources,
    getMedianPrice,
    packAssetsData,
    packOraclesData,
    packPrices,
    verifyPricesTimestamp,
} from '../utils';
import { AbstractCollector } from './AbstractCollector';

export type ClassicCollectorConfig = {
    poolAssetsConfig: PoolAssetConfig[];
    minimalOracles: number;
    evaaOracles: ExtendedEvaaOracle[];
    sourcesConfig?: PriceSourcesConfig;
    additionalPriceSources?: PriceSource[];
};

export class ClassicCollector extends AbstractCollector {
    #prices: RawPriceData[];
    #poolAssetsConfig: PoolAssetConfig[];
    #sourcesConfig: PriceSourcesConfig;
    #priceSources: PriceSource[];
    #minimalOracles: number;

    constructor(config: ClassicCollectorConfig) {
        super();

        this.#poolAssetsConfig = config.poolAssetsConfig;
        this.#sourcesConfig = config.sourcesConfig ?? DefaultPriceSourcesConfig;
        this.#priceSources = generatePriceSources(this.#sourcesConfig, config.evaaOracles);
        this.#minimalOracles = config.minimalOracles;
        if (config.additionalPriceSources) {
            this.#priceSources.push(...config.additionalPriceSources);
        }
        this.#prices = [];
    }

    async getPricesForLiquidate(
        realPrincipals: Dictionary<bigint, bigint>,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        const assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (assets.includes(undefined)) {
            throw new Error('User from another pool');
        }

        const validAssets = assets.map((x) => x!);
        const spotAssets = this.#convertToSpotAssets(validAssets);

        return await this.#getPricesWithMode(spotAssets, ClassicPricesMode.SPOT, fetchConfig);
    }

    async getPricesForWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        withdrawAsset: PoolAssetConfig,
        collateralToDebt = false,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (
            checkNotInDebtAtAll(realPrincipals) &&
            (realPrincipals.get(withdrawAsset.assetId) ?? 0n) > 0n &&
            !collateralToDebt
        ) {
            return ClassicPrices.createEmptyTwapPrices();
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

    async getPricesForSupplyWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        supplyAsset: PoolAssetConfig | undefined,
        withdrawAsset: PoolAssetConfig | undefined,
        collateralToDebt: boolean,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        let assets = this.#filterEmptyPrincipalsAndAssets(realPrincipals);
        if (
            checkNotInDebtAtAll(realPrincipals) &&
            withdrawAsset &&
            (realPrincipals.get(withdrawAsset.assetId) ?? 0n) > 0n &&
            !collateralToDebt
        ) {
            return ClassicPrices.createEmptyTwapPrices();
        }
        if (assets.includes(undefined)) {
            throw new Error('User from another pool');
        }
        if (withdrawAsset && !assets.includes(withdrawAsset)) {
            assets.push(withdrawAsset);
        }
        if (collateralToDebt && assets.length == 1) {
            throw new Error('Cannot debt only one supplied asset');
        }

        const validAssets = assets.map((x) => x!);
        const twapAssets = this.#convertToTwapAssets(validAssets);

        return await this.#getPricesWithMode(twapAssets, ClassicPricesMode.TWAP, fetchConfig);
    }

    async getPrices(
        assets: PoolAssetConfig[] = this.#poolAssetsConfig,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        if (assets.length == 0) {
            return ClassicPrices.createEmptyPrices();
        }

        await this.#collectPricesWithValidation(fetchConfig);

        if (this.#prices.length < this.#minimalOracles) {
            throw new Error(`Error per updating prices, valid ${this.#prices.length} of ${this.#minimalOracles}`);
        }
        const prices = this.#getPricesByAssetList(assets);
        return new ClassicPrices({
            dict: prices.dict,
            dataCell: prices.dataCell,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }

    #getPricesByAssetList(assets: PoolAssetConfig[]) {
        let pricesFiltered = this.#prices;
        if (pricesFiltered.length < this.#minimalOracles) {
            throw new Error('Not enough price data');
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
        const nonEmptymedianData = medianData.filter((x) => x.medianPrice != null) as {
            assetId: bigint;
            medianPrice: bigint;
        }[];
        const packedMedianData = packAssetsData(nonEmptymedianData);
        const oraclesData = pricesFiltered.map((x) => ({
            oracle: { id: x.oracleId, pubkey: x.pubkey },
            data: { timestamp: x.timestamp, prices: x.dict },
            signature: x.signature,
        }));
        const packedOracleData = packOraclesData(
            oraclesData,
            nonEmptymedianData.map((x) => x.assetId),
        );
        const dict = Dictionary.empty<bigint, bigint>();
        for (const medianDataAsset of nonEmptymedianData) {
            dict.set(medianDataAsset.assetId, medianDataAsset.medianPrice);
        }
        return {
            dict: dict,
            dataCell: packPrices(packedMedianData, packedOracleData),
        };
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
        return principals
            .keys()
            .filter((x) => principals.get(x)! != 0n)
            .map((x) => this.#poolAssetsConfig.find((asset) => asset.assetId == x));
    }

    #convertToTwapAssets(assets: PoolAssetConfig[]): PoolAssetConfig[] {
        return assets.map((asset) => ({
            ...asset,
            assetId: asset.assetId - ClassicPricesOffset[ClassicPricesMode.TWAP],
        }));
    }

    #convertToSpotAssets(assets: PoolAssetConfig[]): PoolAssetConfig[] {
        return assets.map((asset) => ({
            ...asset,
            assetId: asset.assetId - ClassicPricesOffset[ClassicPricesMode.SPOT],
        }));
    }

    async #getPricesWithMode(
        assets: PoolAssetConfig[],
        mode: ClassicPricesMode,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        if (assets.length == 0) {
            return ClassicPricesMode.TWAP
                ? ClassicPrices.createEmptyTwapPrices()
                : ClassicPrices.createEmptySpotPrices();
        }

        await this.#collectPricesWithValidation(fetchConfig);

        if (this.#prices.length < this.#minimalOracles) {
            throw new Error(`Error per updating prices, valid ${this.#prices.length} of ${this.#minimalOracles}`);
        }

        const prices = this.#getPricesByAssetList(assets);
        return new ClassicPrices({
            mode,
            dict: prices.dict,
            dataCell: prices.dataCell,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }
}
