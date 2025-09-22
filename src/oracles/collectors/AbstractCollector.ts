import { Dictionary } from '@ton/core';
import { PoolAssetConfig } from '../../types/Master';
import { FetchConfig } from '../../utils/utils';
import { ClassicPrices } from '../prices/ClassicPrices';
import { PythPrices } from '../prices/PythPrices';

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

    abstract getPrices(assets: PoolAssetConfig[], fetchConfig?: FetchConfig): Promise<ClassicPrices | PythPrices>;
}
