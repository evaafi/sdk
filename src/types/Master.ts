import { Address, Cell, Dictionary } from '@ton/core'

export type MasterConstants = {
    FACTOR_SCALE: bigint,
    ASSET_COEFFICIENT_SCALE: bigint,
    ASSET_PRICE_SCALE: bigint,
    ASSET_RESERVE_FACTOR_SCALE: bigint,
    ASSET_LIQUIDATION_RESERVE_FACTOR_SCALE: bigint,
    ASSET_LIQUIDATION_THRESHOLD_SCALE: bigint,
    ASSET_LIQUIDATION_BONUS_SCALE: bigint,
    ASSET_ORIGINATION_FEE_SCALE: bigint,
    ASSET_SRATE_SCALE: bigint,
    ASSET_BRATE_SCALE: bigint,
    COLLATERAL_WORTH_THRESHOLD: bigint,
};

export type PoolAssetsConfig = PoolAssetConfig[];

export type PoolAssetConfig = {
    name: string;
    assetId: bigint;
    jettonMasterAddress: Address;
    jettonWalletCode: Cell;
}

export type PoolConfig = {
    masterAddress: Address;
    masterVersion: number;
    masterConstants: MasterConstants;
    oracles: OracleNFT[];
    minimalOracles: number;
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
    //blankCode: Cell;
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
    minPrincipalForRewards: bigint;
    baseTrackingSupplySpeed: bigint;
    baseTrackingBorrowSpeed: bigint;
};

export type MasterConfig = {
    ifActive: number;
    admin: Address;
    oraclesInfo: OraclesInfo
    tokenKeys: Cell | null;
};

export type OraclesInfo = {
    numOracles: number;
    threshold: number;
    oracles: Cell | null;
};

export type AssetData = {
    sRate: bigint;
    bRate: bigint;
    totalSupply: bigint;
    totalBorrow: bigint;
    lastAccural: bigint;
    balance: bigint;
    trackingSupplyIndex: bigint;
    trackingBorrowIndex: bigint;
    awaitedSupply: bigint;
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

export type AgregatedBalances = {
    totalBorrow: bigint;
    totalSupply: bigint;
}

export type OracleNFT = {
    id: number,
    address: string,
    pubkey: Buffer
}

export type Oracle = {
    id: number,
    pubkey: Buffer
}
