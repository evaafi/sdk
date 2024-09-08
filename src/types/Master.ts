import { Address, Cell, Dictionary } from '@ton/core';

export type MasterConstants = {
    FACTOR_SCALE: bigint,
    ASSET_COEFFICIENT_SCALE: bigint,
    ASSET_PRICE_SCALE: bigint,
    ASSET_RESERVE_FACTOR_SCALE: bigint,
    ASSET_LIQUIDATION_RESERVE_FACTOR_SCALE: bigint,
    ASSET_ORIGINATION_FEE_SCALE: bigint
};

export type PoolAssetConfig = (PoolTonAssetConfig | PoolJettonAssetConfig) & {
    name: string;
};
export type PoolAssetsConfig = PoolAssetConfig[];

export type PoolTonAssetConfig = {
    assetId: bigint;
}

export type PoolJettonAssetConfig = {
    assetId: bigint;
    jettonMasterAddress: Address;
    jettonWalletCode: Cell;
}

export type PoolConfig = {
    masterAddress: Address;
    masterVersion: number;
    masterConstants: MasterConstants;
    nftId: string;
    poolAssetsConfig: PoolAssetsConfig;
    lendingCode: Cell;
};

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
    reserveFactor: bigint;
    liquidationReserveFactor: bigint;
    /* Will be in v6 
    minPrincipalForRewards: bigint;
    baseTrackingSupplySpeed: bigint;
    baseTrackingBorrowSpeed: bigint; */
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
    /* Will be in v6 
    trackingSupplyIndex: bigint;
    trackingBorrowIndex: bigint;
    lastTrackingAccural: bigint; */
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
export type ExtendedAssetsData = Dictionary<bigint, ExtendedAssetData>;
export type ExtendedAssetsConfig = Dictionary<bigint, AssetConfig>;

export type MasterData = {
    meta: string;
    upgradeConfig: UpgradeConfig;
    masterConfig: MasterConfig;
    assetsConfig: ExtendedAssetsConfig;
    assetsData: ExtendedAssetsData;
    assetsReserves: Dictionary<bigint, bigint>;
    apy: {
        supply: Dictionary<bigint, number>;
        borrow: Dictionary<bigint, number>;
    };
};
