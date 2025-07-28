import { Dictionary } from "@ton/core";
import { Prices } from ".";
import { PoolAssetConfig, PoolAssetsConfig } from "../types/Master";

export type FetchPricesConfig = {
    retries: number,
    timeout: number
};

export interface Oracle {
    getPricesForLiquidate(realPrincipals: Dictionary<bigint, bigint>, fetchConfig: FetchPricesConfig): Promise<Prices>;

    getPricesForSupplyWithdraw(realPrincipals: Dictionary<bigint, bigint>,
        supplyAsset: PoolAssetConfig | undefined,
        withdrawAsset: PoolAssetConfig | undefined,
        collateralToDebt: boolean,
        fetchConfig: FetchPricesConfig): Promise<Prices>;

    getPrices(assets: PoolAssetsConfig, fetchConfig: FetchPricesConfig): Promise<Prices>;
}