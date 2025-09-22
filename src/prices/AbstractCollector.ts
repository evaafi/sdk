import { Dictionary } from '@ton/core';
import { PoolAssetConfig, PoolAssetsConfig } from '../types/Master';
import { FetchConfig } from '../utils/utils';
import { ClassicPrices } from './ClassicPrices';
import { PythPrices } from './PythPrices';

export abstract class AbstractCollector {
    abstract getPricesForLiquidate(
        realPrincipals: Dictionary<bigint, bigint>,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices | PythPrices>;

    abstract getPricesForSupplyWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        supplyAsset: PoolAssetConfig | undefined,
        withdrawAsset: PoolAssetConfig | undefined,
        collateralToDebt: boolean,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices | PythPrices>;

    abstract getPrices(assets: PoolAssetsConfig, fetchConfig?: FetchConfig): Promise<ClassicPrices | PythPrices>;
}
