import { beginCell, Cell, Dictionary, DictionaryValue, Slice } from '@ton/core';
import { AssetConfig, AssetData, ExtendedAssetData, ExtendedAssetsConfig, ExtendedAssetsData, MasterConfig, MasterConstants, MasterData, PoolAssetsConfig, PoolConfig } from '../types/Master';
import {
    bigIntMax,
    bigIntMin,
    calculateAssetData,
    calculateLiquidationData,
    calculateMaximumWithdrawAmount,
    calculatePresentValue,
    getAssetLiquidityMinusReserves,
    getAvailableToBorrow,
    presentValue,
} from './math';
import { loadMaybeMyRef, loadMyRef } from './helpers';
import { BalanceType, UserBalance, UserData, UserLiteData, UserRewards } from '../types/User';
import { checkNotInDebtAtAll } from "../api/math";

export function createUserRewards(): DictionaryValue<UserRewards> {
    return {
        serialize: (src: any, buidler: any) => {
            buidler.storeUint(src.trackingIndex, 64);
            buidler.storeUint(src.trackingAccured, 64);
    },
        parse: (src: Slice) => {
            const trackingIndex = BigInt(src.loadUint(64));
            const trackingAccured = BigInt(src.loadUint(64));
            return { trackingIndex, trackingAccured };
        },
    };
}

export function createAssetData(): DictionaryValue<AssetData> {
    return {
        serialize: (src: any, buidler: any) => {
            buidler.storeUint(src.sRate, 64);
            buidler.storeUint(src.bRate, 64);
            buidler.storeInt(src.totalSupply, 64);
            buidler.storeInt(src.totalBorrow, 64);
            buidler.storeUint(src.lastAccural, 32);
            buidler.storeUint(src.balance, 64);
            buidler.storeUint(src.trackingSupplyIndex, 64);
            buidler.storeUint(src.trackingBorrowIndex, 64);
            buidler.storeUint(src.awaitedSupply, 64);
        },
        parse: (src: Slice) => {
            const sRate = BigInt(src.loadUintBig(64));
            const bRate = BigInt(src.loadUintBig(64));
            const totalSupply = BigInt(src.loadIntBig(64));
            const totalBorrow = BigInt(src.loadIntBig(64));
            const lastAccural = BigInt(src.loadUintBig(32));
            const balance = BigInt(src.loadUintBig(64));
            const trackingSupplyIndex = BigInt(src.loadUintBig(64));
            const trackingBorrowIndex = BigInt(src.loadUintBig(64));
            const awaitedSupply = BigInt(src.loadUintBig(64));  

            return { sRate, bRate, totalSupply, totalBorrow, lastAccural, balance, trackingSupplyIndex, trackingBorrowIndex, awaitedSupply};
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
            refBuild.storeUint(src.dust, 64);
            refBuild.storeUint(src.maxTotalSupply, 64);
            refBuild.storeUint(src.reserveFactor, 16);
            refBuild.storeUint(src.liquidationReserveFactor, 16);
            refBuild.storeUint(src.minPrincipalForRewards, 64);
            refBuild.storeUint(src.baseTrackingSupplySpeed, 64);
            refBuild.storeUint(src.baseTrackingBorrowSpeed, 64);
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
            const reserveFactor = ref.loadUintBig(16);
            const liquidationReserveFactor = ref.loadUintBig(16);
            const minPrincipalForRewards = ref.loadUintBig(64);
            const baseTrackingSupplySpeed = ref.loadUintBig(64);
            const baseTrackingBorrowSpeed = ref.loadUintBig(64);

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
                reserveFactor,
                liquidationReserveFactor,
                minPrincipalForRewards,
                baseTrackingSupplySpeed,
                baseTrackingBorrowSpeed
            };
        },
    };
}

export function parseMasterData(masterDataBOC: string, poolAssetsConfig: PoolAssetsConfig, masterConstants: MasterConstants): MasterData {
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
        newMasterCode: loadMaybeMyRef(upgradeConfigParser),
        newUserCode: loadMaybeMyRef(upgradeConfigParser),
    };
    // upgradeConfigParser.endParse(); todo fix with new testnet contract

    const masterConfigSlice = masterSlice.loadRef().beginParse();
    const assetsConfigDict = masterConfigSlice.loadDict(Dictionary.Keys.BigUint(256), createAssetConfig());
    const assetsDataDict = masterSlice.loadDict(Dictionary.Keys.BigUint(256), createAssetData());

    const assetsExtendedData = Dictionary.empty<bigint, ExtendedAssetData>();
    const assetsReserves = Dictionary.empty<bigint, bigint>();
    const apy = {
        supply: Dictionary.empty<bigint, number>(),
        borrow: Dictionary.empty<bigint, number>(),
    };
    
    for (const [tokenSymbol, asset] of Object.entries(poolAssetsConfig)) {
        const assetData = calculateAssetData(assetsConfigDict, assetsDataDict, asset.assetId, masterConstants);
        assetsExtendedData.set(asset.assetId, assetData);
    }
    const masterConfig = {
        ifActive: masterConfigSlice.loadInt(8),
        admin: masterConfigSlice.loadAddress(),
        oraclesInfo:  {
            numOracles: masterConfigSlice.loadUint(16),
            threshold: masterConfigSlice.loadUint(16),
            oracles: loadMaybeMyRef(masterConfigSlice)
        },
        tokenKeys: loadMaybeMyRef(masterConfigSlice),
    };
    masterConfigSlice.endParse();

    for (const [_, asset] of Object.entries(poolAssetsConfig)) {
        const assetData = assetsExtendedData.get(asset.assetId) as ExtendedAssetData;
        const totalSupply = calculatePresentValue(assetData.sRate, assetData.totalSupply, masterConstants);
        const totalBorrow = calculatePresentValue(assetData.bRate, assetData.totalBorrow, masterConstants);
        assetsReserves.set(asset.assetId, assetData.balance - totalSupply + totalBorrow);

        apy.supply.set(asset.assetId, (1 + (Number(assetData.supplyInterest) / 1e12) * 24 * 3600) ** 365 - 1);
        apy.borrow.set(asset.assetId, (1 + (Number(assetData.borrowInterest) / 1e12) * 24 * 3600) ** 365 - 1);
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
    assetsData: ExtendedAssetsData,
    assetsConfig: ExtendedAssetsConfig,
    poolConfig: PoolConfig,
    applyDust: boolean = false
): UserLiteData {
    const poolAssetsConfig = poolConfig.poolAssetsConfig;
    const masterConstants = poolConfig.masterConstants;

    const userSlice = Cell.fromBase64(userDataBOC).beginParse();

    const codeVersion = userSlice.loadCoins();
    const masterAddress = userSlice.loadAddress();
    const userAddress = userSlice.loadAddress();
    const realPrincipals = userSlice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.BigInt(64));
    const principalsDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.BigInt(64));
    const userState = userSlice.loadInt(64);

    let trackingSupplyIndex = 0n;
    let trackingBorrowIndex = 0n;
    let dutchAuctionStart = 0;
    let backupCell = Cell.EMPTY;
    let rewards = Dictionary.empty(Dictionary.Keys.BigUint(256), createUserRewards());
    let backupCell1: Cell | null = null;
    let backupCell2: Cell | null = null;
    const bitsLeft = userSlice.remainingBits;
    if (bitsLeft > 32) {
        trackingSupplyIndex = userSlice.loadUintBig(64);
        trackingBorrowIndex = userSlice.loadUintBig(64);
        dutchAuctionStart = userSlice.loadUint(32);
        backupCell = loadMyRef(userSlice);
    } else {
        rewards = userSlice.loadDict(Dictionary.Keys.BigUint(256), createUserRewards());
        backupCell1 = userSlice.loadMaybeRef();
        backupCell2 = userSlice.loadMaybeRef();
    }
    
    userSlice.endParse();
    const userBalances = Dictionary.empty<bigint, UserBalance>();

    for (const [_, asset] of Object.entries(poolAssetsConfig)) {
        const assetData = assetsData.get(asset.assetId) as ExtendedAssetData;
        const assetConfig = assetsConfig.get(asset.assetId) as AssetConfig;

        let principal = realPrincipals.get(asset.assetId) || 0n;
        let balance = presentValue(assetData.sRate, assetData.bRate, principal, masterConstants);

        if (applyDust && (principal > 0 && (principal < assetConfig.dust))) {
            principal = 0n;
            balance = {
                amount: 0n,
                type: BalanceType.supply,
            };
            principalsDict.set(asset.assetId, 0n);
        } else {
            principalsDict.set(asset.assetId, principal);
        }
        userBalances.set(asset.assetId, balance);
    }

    return {
        type: 'active',
        codeVersion: Number(codeVersion),
        masterAddress: masterAddress,
        ownerAddress: userAddress,
        principals: principalsDict,
        realPrincipals: realPrincipals,
        state: userState,
        balances: userBalances,
        trackingSupplyIndex: trackingSupplyIndex,
        trackingBorrowIndex: trackingBorrowIndex,
        dutchAuctionStart: dutchAuctionStart,
        backupCell: backupCell,
        fullyParsed: false,
        
        rewards: rewards,
        backupCell1: backupCell1,
        backupCell2: backupCell2,
    };
}

export function parseUserData(
    userLiteData: UserLiteData,
    assetsData: ExtendedAssetsData,
    assetsConfig: ExtendedAssetsConfig,
    prices: Dictionary<bigint, bigint>,
    poolConfig: PoolConfig,
    applyDust: boolean = false
): UserData {
    userLiteData.fullyParsed = true;
    let havePrincipalWithoutPrice = false;

    const poolAssetsConfig = poolConfig.poolAssetsConfig;
    const masterConstants = poolConfig.masterConstants;

    const withdrawalLimits = Dictionary.empty<bigint, bigint>();
    const borrowLimits = Dictionary.empty<bigint, bigint>();

    let supplyBalance = 0n;
    let borrowBalance = 0n;

    for (const [assetId, principal] of userLiteData.realPrincipals) {
        if (!prices.has(assetId)) {
            userLiteData.fullyParsed = false;

            if (principal != 0n) {
                havePrincipalWithoutPrice = true;
            }
        }
    }

    for (const [_, asset] of Object.entries(poolAssetsConfig)) {
        const assetData = assetsData.get(asset.assetId) as ExtendedAssetData;
        const assetConfig = assetsConfig.get(asset.assetId) as AssetConfig;

        let principal = userLiteData.principals.get(asset.assetId) || 0n;
        const balance = presentValue(assetData.sRate, assetData.bRate, principal, masterConstants);

        if (applyDust && (principal > 0 && (principal < assetConfig.dust))) {
            principal = 0n;
            userLiteData.principals.set(asset.assetId, 0n);
        }

        userLiteData.balances.set(asset.assetId, balance);
    }

    for (const [_, asset] of Object.entries(poolAssetsConfig)) {
        if (!prices.has(asset.assetId)) {
            continue;
        }

        const assetConfig = assetsConfig.get(asset.assetId) as AssetConfig;
        const balance = userLiteData.balances.get(asset.assetId) as UserBalance;

        if (balance.type === BalanceType.supply) {
            supplyBalance += (balance.amount * prices.get(asset.assetId)!) / 10n ** assetConfig.decimals;
        }
        if (balance.type === BalanceType.borrow) {
            borrowBalance += (balance.amount * prices.get(asset.assetId)!) / 10n ** assetConfig.decimals;
        }
    }

    const availableToBorrow = getAvailableToBorrow(assetsConfig, assetsData, userLiteData.realPrincipals, prices, masterConstants);

    for (const [_, asset] of Object.entries(poolAssetsConfig)) {
        const balance = userLiteData.balances.get(asset.assetId) as UserBalance;
        const assetConfig = assetsConfig.get(asset.assetId) as AssetConfig;
        const assetData = assetsData.get(asset.assetId) as ExtendedAssetData;
        
        const assetLiquidityMinusReserves = getAssetLiquidityMinusReserves(assetData, masterConstants);

        if (balance.type === BalanceType.supply) {
            withdrawalLimits.set(
                asset.assetId,
                bigIntMin(calculateMaximumWithdrawAmount(assetsConfig, assetsData, userLiteData.realPrincipals, prices, masterConstants, asset.assetId), assetData.balance)
            );
        }

        if (!prices.has(asset.assetId)) {
            borrowLimits.set(asset.assetId, 0n);
            continue;
        }

        borrowLimits.set(
            asset.assetId,
            bigIntMax(0n, bigIntMin((availableToBorrow * 10n ** assetConfig.decimals) / prices.get(asset.assetId)!, assetLiquidityMinusReserves)),
        );
    }

    const limitUsed = borrowBalance + availableToBorrow;
    const limitUsedPercent =
        limitUsed === 0n
            ? 0
            : Number(BigInt(1e9) - (availableToBorrow * BigInt(1e9)) / (borrowBalance + availableToBorrow)) / 1e7;

    let healthFactor = 1;
    let liquidationData;
    if (!havePrincipalWithoutPrice) {
        liquidationData = calculateLiquidationData(assetsConfig, assetsData, userLiteData.realPrincipals, prices, poolConfig);
        if (liquidationData.totalLimit != 0n) {
            healthFactor = 1 - Number(liquidationData.totalDebt) / Number(liquidationData.totalLimit);
        } 
    }
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
        havePrincipalWithoutPrice: havePrincipalWithoutPrice
    };
}
