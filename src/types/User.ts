import { Address, Cell, Dictionary } from '@ton/core';

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
    greatestCollateralAsset: bigint;
    greatestLoanValue: bigint;
    greatestLoanAsset: bigint;
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
