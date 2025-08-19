import { Dictionary } from '@ton/core';
import { Prices } from '.';
import { PoolAssetConfig, PoolAssetsConfig } from '../types/Master';
import { FetchConfig } from '../utils/utils';

export interface Oracle {
    getPricesForLiquidate(realPrincipals: Dictionary<bigint, bigint>, fetchConfig?: FetchConfig): Promise<Prices>;

    getPricesForSupplyWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        supplyAsset: PoolAssetConfig | undefined,
        withdrawAsset: PoolAssetConfig | undefined,
        collateralToDebt: boolean,
        fetchConfig?: FetchConfig,
    ): Promise<Prices>;

    getPrices(assets: PoolAssetsConfig, fetchConfig?: FetchConfig): Promise<Prices>;
}
