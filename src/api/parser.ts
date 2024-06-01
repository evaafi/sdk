import { beginCell, Cell, Dictionary, DictionaryValue, Slice } from '@ton/core';
import { AssetConfig, AssetData, ExtendedAssetData, MasterData } from '../types/Master';
import { MAINNET_ASSETS_ID, MASTER_CONSTANTS, TESTNET_ASSETS_ID } from '../constants';
import {
    bigIntMax,
    bigIntMin,
    calculateAssetData,
    calculateLiquidationData,
    calculatePresentValue,
    getAvailableToBorrow,
    presentValue,
} from './math';
import { loadMaybeMyRef, loadMyRef } from './helpers';
import { BalanceType, UserBalance, UserData, UserLiteData } from '../types/User';

export function createAssetData(): DictionaryValue<AssetData> {
    return {
        serialize: (src: any, buidler: any) => {
            buidler.storeUint(src.sRate, 64);
            buidler.storeUint(src.bRate, 64);
            buidler.storeUint(src.totalSupply, 64);
            buidler.storeUint(src.totalBorrow, 64);
            buidler.storeUint(src.lastAccural, 32);
            buidler.storeUint(src.balance, 64);
        },
        parse: (src: Slice) => {
            const sRate = BigInt(src.loadInt(64));
            const bRate = BigInt(src.loadInt(64));
            const totalSupply = BigInt(src.loadInt(64));
            const totalBorrow = BigInt(src.loadInt(64));
            const lastAccural = BigInt(src.loadInt(32));
            const balance = BigInt(src.loadInt(64));
            return { sRate, bRate, totalSupply, totalBorrow, lastAccural, balance };
        },
    };
}

export function createAssetConfig(): DictionaryValue<AssetConfig> {
    return {
        serialize: (src: any, builder: any) => {
            builder.storeUint(src.oracle, 256);
            builder.storeUint(src.decimals, 8);
            const refBuild = beginCell();
            refBuild.storeUint(src.collateralFactor, 16);
            refBuild.storeUint(src.liquidationThreshold, 16);
            refBuild.storeUint(src.liquidationBonus, 16);
            refBuild.storeUint(src.baseBorrowRate, 64);
            refBuild.storeUint(src.borrowRateSlopeLow, 64);
            refBuild.storeUint(src.borrowRateSlopeHigh, 64);
            refBuild.storeUint(src.supplyRateSlopeLow, 64);
            refBuild.storeUint(src.supplyRateSlopeHigh, 64);
            refBuild.storeUint(src.targetUtilization, 64);
            refBuild.storeUint(src.originationFee, 64);
            refBuild.storeUint(src.maxTotalSupply, 64);
            builder.storeRef(refBuild.endCell());
        },
        parse: (src: Slice) => {
            const oracle = src.loadUintBig(256);
            const decimals = BigInt(src.loadUint(8));
            const ref = src.loadRef().beginParse();
            const collateralFactor = ref.loadUintBig(16);
            const liquidationThreshold = ref.loadUintBig(16);
            const liquidationBonus = ref.loadUintBig(16);
            const baseBorrowRate = ref.loadUintBig(64);
            const borrowRateSlopeLow = ref.loadUintBig(64);
            const borrowRateSlopeHigh = ref.loadUintBig(64);
            const supplyRateSlopeLow = ref.loadUintBig(64);
            const supplyRateSlopeHigh = ref.loadUintBig(64);
            const targetUtilization = ref.loadUintBig(64);
            const originationFee = ref.loadUintBig(64);
            const dust = ref.loadUintBig(64);
            const maxTotalSupply = ref.loadUintBig(64);

            return {
                oracle,
                decimals,
                collateralFactor,
                liquidationThreshold,
                liquidationBonus,
                baseBorrowRate,
                borrowRateSlopeLow,
                borrowRateSlopeHigh,
                supplyRateSlopeLow,
                supplyRateSlopeHigh,
                targetUtilization,
                originationFee,
                dust,
                maxTotalSupply,
            };
        },
    };
}

export function parseMasterData(masterDataBOC: string, testnet: boolean = false): MasterData {
    const ASSETS_ID = testnet ? TESTNET_ASSETS_ID : MAINNET_ASSETS_ID;
    const masterSlice = Cell.fromBase64(masterDataBOC).beginParse();
    const meta = masterSlice.loadRef().beginParse().loadStringTail();
    const upgradeConfigParser = masterSlice.loadRef().beginParse();

    const upgradeConfig = {
        masterCodeVersion: Number(upgradeConfigParser.loadCoins()),
        userCodeVersion: Number(upgradeConfigParser.loadCoins()),
        timeout: upgradeConfigParser.loadUint(32),
        updateTime: upgradeConfigParser.loadUint(64),
        freezeTime: upgradeConfigParser.loadUint(64),
        userCode: loadMyRef(upgradeConfigParser),
        blankCode: loadMyRef(upgradeConfigParser),
        newMasterCode: loadMaybeMyRef(upgradeConfigParser),
        newUserCode: loadMaybeMyRef(upgradeConfigParser),
    };
    upgradeConfigParser.endParse();

    const masterConfigSlice = masterSlice.loadRef().beginParse();

    const assetsConfigDict = masterConfigSlice.loadDict(Dictionary.Keys.BigUint(256), createAssetConfig());
    const assetsDataDict = masterSlice.loadDict(Dictionary.Keys.BigUint(256), createAssetData());
    const assetsExtendedData = Dictionary.empty<bigint, ExtendedAssetData>();
    const assetsReserves = Dictionary.empty<bigint, bigint>();
    const apy = {
        supply: Dictionary.empty<bigint, number>(),
        borrow: Dictionary.empty<bigint, number>(),
    };

    for (const [tokenSymbol, assetID] of Object.entries(ASSETS_ID)) {
        const assetData = calculateAssetData(assetsConfigDict, assetsDataDict, assetID);
        assetsExtendedData.set(assetID, assetData);
    }

    const masterConfig = {
        ifActive: masterConfigSlice.loadInt(8),
        admin: masterConfigSlice.loadAddress(),
        adminPK: masterConfigSlice.loadUintBig(256),
        tokenKeys: loadMaybeMyRef(masterConfigSlice),
        walletToMaster: loadMaybeMyRef(masterConfigSlice),
    };

    masterConfigSlice.endParse();

    for (const [_, assetID] of Object.entries(ASSETS_ID)) {
        const assetData = assetsExtendedData.get(assetID) as ExtendedAssetData;
        const totalSupply = calculatePresentValue(assetData.sRate, assetData.totalSupply);
        const totalBorrow = calculatePresentValue(assetData.bRate, assetData.totalBorrow);
        assetsReserves.set(assetID, assetData.balance - totalSupply + totalBorrow);

        apy.supply.set(assetID, (1 + (Number(assetData.supplyInterest) / 1e12) * 24 * 3600) ** 365 - 1);
        apy.borrow.set(assetID, (1 + (Number(assetData.borrowInterest) / 1e12) * 24 * 3600) ** 365 - 1);
    }

    return {
        meta: meta,
        upgradeConfig: upgradeConfig,
        masterConfig: masterConfig,
        assetsConfig: assetsConfigDict,
        assetsData: assetsExtendedData,
        assetsReserves: assetsReserves,
        apy: apy,
    };
}

export function parseUserLiteData(
    userDataBOC: string,
    assetsData: Dictionary<bigint, ExtendedAssetData>,
    assetsConfig: Dictionary<bigint, AssetConfig>,
    testnet: boolean = false,
): UserLiteData {
    const ASSETS_ID = testnet ? TESTNET_ASSETS_ID : MAINNET_ASSETS_ID;
    const userSlice = Cell.fromBase64(userDataBOC).beginParse();

    const codeVersion = userSlice.loadCoins();
    const masterAddress = userSlice.loadAddress();
    const userAddress = userSlice.loadAddress();
    const principalsDict = userSlice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.BigInt(64));
    const userState = userSlice.loadInt(64);
    const trackingSupplyIndex = userSlice.loadUintBig(64);
    const trackingBorrowIndex = userSlice.loadUintBig(64);
    const dutchAuctionStart = userSlice.loadUint(32);
    const backupCell = loadMyRef(userSlice);
    userSlice.endParse();

    const userBalances = Dictionary.empty<bigint, UserBalance>();

    for (const [_, assetID] of Object.entries(ASSETS_ID)) {
        const assetData = assetsData.get(assetID) as ExtendedAssetData;
        const assetConfig = assetsConfig.get(assetID) as AssetConfig;
        const balance = presentValue(assetData.sRate, assetData.bRate, principalsDict.get(assetID) || 0n);
        userBalances.set(assetID, balance);
    }

    return {
        type: 'active',
        codeVersion: Number(codeVersion),
        masterAddress: masterAddress,
        ownerAddress: userAddress,
        principals: principalsDict,
        state: userState,
        balances: userBalances,
        trackingSupplyIndex: trackingSupplyIndex,
        trackingBorrowIndex: trackingBorrowIndex,
        dutchAuctionStart: dutchAuctionStart,
        backupCell: backupCell,
    };
}

export function parseUserData(
    userLiteData: UserLiteData,
    assetsData: Dictionary<bigint, ExtendedAssetData>,
    assetsConfig: Dictionary<bigint, AssetConfig>,
    prices: Dictionary<bigint, bigint>,
    testnet: boolean = false,
): UserData {
    const ASSETS_ID = testnet ? TESTNET_ASSETS_ID : MAINNET_ASSETS_ID;
    const withdrawalLimits = Dictionary.empty<bigint, bigint>();
    const borrowLimits = Dictionary.empty<bigint, bigint>();

    let supplyBalance = 0n;
    let borrowBalance = 0n;
    for (const [_, assetID] of Object.entries(ASSETS_ID)) {
        const assetData = assetsData.get(assetID) as ExtendedAssetData;
        const assetConfig = assetsConfig.get(assetID) as AssetConfig;
        const balance = presentValue(assetData.sRate, assetData.bRate, userLiteData.principals.get(assetID) || 0n);
        userLiteData.balances.set(assetID, balance);
    }

    for (const [_, assetID] of Object.entries(ASSETS_ID)) {
        const assetConfig = assetsConfig.get(assetID) as AssetConfig;
        const balance = userLiteData.balances.get(assetID) as UserBalance;

        if (balance.type === BalanceType.supply) {
            supplyBalance += (balance.amount * prices.get(assetID)!) / 10n ** assetConfig.decimals;
        }
        if (balance.type === BalanceType.borrow) {
            borrowBalance += (balance.amount * prices.get(assetID)!) / 10n ** assetConfig.decimals;
        }
    }

    const availableToBorrow = getAvailableToBorrow(assetsConfig, assetsData, userLiteData.principals, prices);
    for (const [_, assetID] of Object.entries(ASSETS_ID)) {
        const assetConfig = assetsConfig.get(assetID) as AssetConfig;
        const assetData = assetsData.get(assetID) as ExtendedAssetData;
        const balance = userLiteData.balances.get(assetID) as UserBalance;

        if (balance.type === BalanceType.supply) {
            withdrawalLimits.set(
                assetID,
                bigIntMax(
                    bigIntMin(
                        assetData.balance,
                        ((supplyBalance -
                            (borrowBalance * MASTER_CONSTANTS.ASSET_COEFFICIENT_SCALE) / assetConfig.collateralFactor) *
                            10n ** assetConfig.decimals) /
                            prices.get(assetID)! -
                            5n,
                        balance.amount,
                    ),
                    0n,
                ),
            );
        } else {
            borrowLimits.set(
                assetID,
                bigIntMin((availableToBorrow * 10n ** assetConfig.decimals) / prices.get(assetID)!, assetData.balance),
            );
        }
    }

    const limitUsed = borrowBalance + availableToBorrow;
    const limitUsedPercent =
        limitUsed === 0n
            ? 0
            : Number(BigInt(1e9) - (availableToBorrow * BigInt(1e9)) / (borrowBalance + availableToBorrow)) / 1e7;

    const liquidationData = calculateLiquidationData(assetsConfig, assetsData, userLiteData.principals, prices);
    const healthFactor = 1 - Number(liquidationData.totalDebt) / Number(liquidationData.totalLimit);

    return {
        ...userLiteData,
        withdrawalLimits: withdrawalLimits,
        borrowLimits: borrowLimits,
        supplyBalance: supplyBalance,
        borrowBalance: borrowBalance,
        availableToBorrow: availableToBorrow,
        limitUsedPercent: limitUsedPercent,
        limitUsed: limitUsed,
        liquidationData: liquidationData,
        healthFactor: healthFactor,
    };
}
