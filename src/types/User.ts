import { Address, Cell, Dictionary } from '@ton/core';

export enum BalanceType {
    supply = 'supply',
    borrow = 'borrow',
}

export type UserBalance = {
    amount: bigint;
    type?: BalanceType;
};

export type BaseLiquidationData = {
    greatestCollateralValue: bigint;
    greatestCollateralAsset: bigint;
    greatestLoanValue: bigint;
    greatestLoanAsset: bigint;
    totalDebt: bigint;
    totalLimit: bigint;
};

export type LiquidableData = BaseLiquidationData & {
    liquidable: true;
    liquidationAmount: bigint;
    minCollateralAmount: bigint;
};

export type NonLiquidableData = BaseLiquidationData & {
    liquidable: false;
};

export type LiquidationData = LiquidableData | NonLiquidableData;

export type UserDataActive = {
    type: 'active';
    codeVersion: number;
    masterAddress: Address;
    ownerAddress: Address;
    principals: Dictionary<bigint, bigint>;
    state: number;
    balances: Dictionary<bigint, UserBalance>;
    withdrawalLimits: Dictionary<bigint, bigint>;
    borrowLimits: Dictionary<bigint, bigint>;
    repayLimits?: Dictionary<bigint, bigint>;
    apy: {
        supply: Dictionary<bigint, number>;
        borrow: Dictionary<bigint, number>;
    };
    supplyBalance: bigint;
    borrowBalance: bigint;
    availableToBorrow: bigint;
    limitUsedPercent: number;
    limitUsed: number;

    trackingSupplyIndex: bigint;
    trackingBorrowIndex: bigint;
    dutchAuctionStart: number;
    backupCell: Cell;

    liquidationData: LiquidationData;
};

export type UserDataInactive = {
    type: 'inactive';
};

export type UserData = UserDataActive | UserDataInactive;
