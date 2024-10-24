import { Address, Cell, Dictionary } from '@ton/core';
import { AssetConfig, ExtendedAssetData, ExtendedAssetsConfig, ExtendedAssetsData, MasterConfig, MasterConstants, PoolAssetConfig, PoolConfig } from './Master';

export enum BalanceType {
    supply = 'supply',
    borrow = 'borrow',
}

export type UserBalance = {
    amount: bigint;
    type?: BalanceType;
};

export type UserLiqudationData = {
    greatestCollateralValue: bigint;
    greatestCollateralAsset: PoolAssetConfig;
    greatestLoanValue: bigint;
    greatestLoanAsset: PoolAssetConfig;
    totalDebt: bigint;
    totalLimit: bigint;
};

export type LiquidableData = UserLiqudationData & {
    liquidable: true;
    liquidationAmount: bigint;
    minCollateralAmount: bigint;
};

export type NonLiquidableData = UserLiqudationData & {
    liquidable: false;
};

export type LiquidationData = LiquidableData | NonLiquidableData;

export type UserLiteData = {
    type: 'active';
    codeVersion: number;
    masterAddress: Address;
    ownerAddress: Address;
    principals: Dictionary<bigint, bigint>;
    state: number;
    balances: Dictionary<bigint, UserBalance>;
    trackingSupplyIndex: bigint;
    trackingBorrowIndex: bigint;
    dutchAuctionStart: number;
    backupCell: Cell;
    rewards: Dictionary<bigint, UserRewards>;
    backupCell1: Cell | null;
    backupCell2: Cell | null;
};

export type UserDataActive = UserLiteData & {
    withdrawalLimits: Dictionary<bigint, bigint>;
    borrowLimits: Dictionary<bigint, bigint>;
    repayLimits?: Dictionary<bigint, bigint>;
    supplyBalance: bigint;
    borrowBalance: bigint;
    availableToBorrow: bigint;
    limitUsedPercent: number;
    limitUsed: bigint;
    healthFactor: number;

    liquidationData: LiquidationData;
};

export type UserDataInactive = {
    type: 'inactive';
};

export type UserData = UserDataActive | UserDataInactive;

export type UserRewards = {
    trackingIndex: bigint;
    trackingAccured: bigint;
};

export type HealthParamsArgs = {
    assetsData: ExtendedAssetsData;
    assetsConfig: ExtendedAssetsConfig;
    principals: Dictionary<bigint, bigint>;
    prices: Dictionary<bigint, bigint>;
    poolConfig: PoolConfig;
}

export enum BalanceChangeType {
    Borrow = 0,
    Repay = 1,
    Supply = 2,
    Withdraw = 3
}

export type PredictHealthFactorArgs = {
    balanceChangeType: BalanceChangeType;
    amount: bigint;  // always positive
    asset: PoolAssetConfig;
    principals: Dictionary<bigint, bigint>;
    prices: Dictionary<bigint, bigint>;
    assetsData: ExtendedAssetsData;
    assetsConfig: ExtendedAssetsConfig;
    poolConfig: PoolConfig;
};
