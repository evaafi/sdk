import { Address, Cell, Dictionary } from '@ton/core';

export type UpgradeConfig = {
    masterCodeVersion: number;
    userCodeVersion: number;
    timeout: number;
    updateTime: number;
    freezeTime: number;
    userCode: Cell;
    blankCode: Cell;
    newMasterCode: Cell | null;
    newUserCode: Cell | null;
};

export type AssetConfig = {
    oracle: bigint;
    decimals: bigint;
    collateralFactor: bigint;
    liquidationThreshold: bigint;
    liquidationBonus: bigint;
    baseBorrowRate: bigint;
    borrowRateSlopeLow: bigint;
    borrowRateSlopeHigh: bigint;
    supplyRateSlopeLow: bigint;
    supplyRateSlopeHigh: bigint;
    targetUtilization: bigint;
    originationFee: bigint;
    dust: bigint;
    maxTotalSupply: bigint;
};

export type MasterConfig = {
    ifActive: number;
    admin: Address;
    adminPK: bigint;
    tokenKeys: Cell | null;
    walletToMaster: Cell | null;
};

export type AssetData = {
    sRate: bigint;
    bRate: bigint;
    totalSupply: bigint;
    totalBorrow: bigint;
    lastAccural: bigint;
    balance: bigint;
};

export type AssetInterest = {
    supplyInterest: bigint;
    borrowInterest: bigint;
};

export type AssetApy = {
    supplyApy: number;
    borrowApy: number;
};

export type ExtendedAssetData = AssetData & AssetInterest & AssetApy;

export type MasterData = {
    meta: string;
    upgradeConfig: UpgradeConfig;
    masterConfig: MasterConfig;
    assetsConfig: Dictionary<bigint, AssetConfig>;
    assetsData: Dictionary<bigint, ExtendedAssetData>;
    assetsReserves: Dictionary<bigint, bigint>;
    apy: {
        supply: Dictionary<bigint, number>;
        borrow: Dictionary<bigint, number>;
    };
};
