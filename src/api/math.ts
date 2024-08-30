import { AssetConfig, AssetData, AssetInterest, ExtendedAssetData, ExtendedAssetsConfig, ExtendedAssetsData, MasterConstants } from '../types/Master';
import { Dictionary } from '@ton/core';
import { BalanceChangeType, BalanceType, LiquidationData, PredictHealthFactorArgs, UserBalance } from '../types/User';
import { sha256Hash } from '../utils/sha256BigInt';

export function mulFactor(decimal: bigint, a: bigint, b: bigint): bigint {
    return (a * b) / decimal;
}

export function mulDiv(x: bigint, y: bigint, z: bigint): bigint {
    return (x * y) / z;
}

export function bigIntMax(...args: bigint[]): bigint {
    return args.reduce((m, e) => (e > m ? e : m));
}
export function bigIntMin(...args: bigint[]): bigint {
    return args.reduce((m, e) => (e < m ? e : m));
}

export function calculatePresentValue(index: bigint, principalValue: bigint, masterConstants: MasterConstants): bigint {
    return (principalValue * index) / masterConstants.FACTOR_SCALE;
}

export function calculateCurrentRates(assetConfig: AssetConfig, assetData: AssetData, masterConstants: MasterConstants) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeElapsed = now - assetData.lastAccural;
    const { supplyInterest, borrowInterest } = calculateAssetInterest(assetConfig, assetData, masterConstants);

    if (timeElapsed > 0) {
        const updatedSRate =
            assetData.sRate + mulFactor(masterConstants.FACTOR_SCALE, assetData.sRate, supplyInterest * timeElapsed);
        const updatedBRate =
            assetData.bRate + mulFactor(masterConstants.FACTOR_SCALE, assetData.bRate, borrowInterest * timeElapsed);
        return {
            sRate: updatedSRate,
            bRate: updatedBRate,
            supplyInterest,
            borrowInterest,
            now,
        };
    }

    return {
        sRate: assetData.sRate,
        bRate: assetData.bRate,
        supplyInterest,
        borrowInterest,
        now,
    };
}

export function calculateAssetData(
    assetsConfigDict: ExtendedAssetsConfig,
    assetsDataDict: Dictionary<bigint, AssetData>,
    assetId: bigint,
    masterConstants: MasterConstants
): ExtendedAssetData {
    const config = assetsConfigDict.get(assetId);
    const data = assetsDataDict.get(assetId);

    if (!data || !config) {
        throw new Error('Asset Data or Config is not accessible');
    }

    const { sRate, bRate, supplyInterest, borrowInterest, now } = calculateCurrentRates(config, data, masterConstants);
    data.sRate = sRate || 0n;
    data.bRate = bRate || 0n;
    data.lastAccural = now;

    const supplyApy = (1 + (Number(supplyInterest) / 1e12) * 24 * 3600) ** 365 - 1;
    const borrowApy = (1 + (Number(borrowInterest) / 1e12) * 24 * 3600) ** 365 - 1;

    return {
        ...data,
        ...{ supplyInterest, borrowInterest },
        ...{ supplyApy, borrowApy },
    };
}

export function calculateAssetInterest(assetConfig: AssetConfig, assetData: AssetData, masterConstants: MasterConstants): AssetInterest {
    const totalSupply = calculatePresentValue(assetData.sRate, assetData.totalSupply, masterConstants);
    const totalBorrow = calculatePresentValue(assetData.bRate, assetData.totalBorrow, masterConstants);
    let utilization = 0n;
    let supplyInterest = 0n;
    let borrowInterest = 0n;

    if (totalSupply !== 0n) {
        utilization = (totalBorrow * masterConstants.FACTOR_SCALE) / totalSupply;
    }

    if (utilization <= assetConfig.targetUtilization) {
        borrowInterest =
            assetConfig.baseBorrowRate +
            mulFactor(masterConstants.FACTOR_SCALE, assetConfig.borrowRateSlopeLow, utilization);
    } else {
        borrowInterest =
            assetConfig.baseBorrowRate +
            mulFactor(masterConstants.FACTOR_SCALE, assetConfig.borrowRateSlopeLow, assetConfig.targetUtilization) +
            mulFactor(
                masterConstants.FACTOR_SCALE,
                assetConfig.borrowRateSlopeHigh,
                utilization - assetConfig.targetUtilization,
            );
    }

    supplyInterest = mulDiv(
        mulDiv(borrowInterest, utilization, masterConstants.FACTOR_SCALE),
        masterConstants.ASSET_RESERVE_FACTOR_SCALE - assetConfig.reserveFactor,
        masterConstants.ASSET_RESERVE_FACTOR_SCALE,
    );

    return {
        supplyInterest,
        borrowInterest,
    };
}

export function getAvailableToBorrow(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    masterConstants: MasterConstants
): bigint {
    let borrowLimit = 0n;
    let borrowAmount = 0n;

    for (const assetID of principals.keys()) {
        const assetConfig = assetsConfig.get(assetID) as AssetConfig;
        const assetData = assetsData.get(assetID) as ExtendedAssetData;
        const price = prices.get(assetID) as bigint;
        const principal = principals.get(assetID) as bigint;

        if (principal < 0) {
            borrowAmount += (calculatePresentValue(assetData.bRate, -principal, masterConstants) * price) / 10n ** assetConfig.decimals;
        } else if (principal > 0) {
            borrowLimit +=
                (calculatePresentValue(assetData.sRate, principal, masterConstants) * price * assetConfig.collateralFactor) /
                10n ** assetConfig.decimals /
                masterConstants.ASSET_COEFFICIENT_SCALE;
        }
    }

    return borrowLimit - borrowAmount;
}

export function presentValue(sRate: bigint, bRate: bigint, principalValue: bigint, masterConstants: MasterConstants): UserBalance {
    if (principalValue > 0) {
        return {
            amount: calculatePresentValue(sRate, principalValue, masterConstants),
            type: BalanceType.supply,
        };
    } else if (principalValue < 0) {
        return {
            amount: calculatePresentValue(bRate, -principalValue, masterConstants),
            type: BalanceType.borrow,
        };
    } else {
        return {
            amount: 0n,
            type: undefined,
        };
    }
}

export function calculateLiquidationData(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    masterConstants: MasterConstants,
): LiquidationData {
    let gCollateralValue = 0n;
    let gCollateralAsset = 0n;
    let gLoanValue = 0n;
    let gLoanAsset = 0n;
    let totalDebt = 0n;
    let totalLimit = 0n;

    for (const key of principals.keys()) {
        const principal = principals.get(key)!;
        const assetConfig = assetsConfig.get(key)!;
        const assetData = assetsData.get(key)!;
        const balance =
            principal > 0 ? (principal * assetData.sRate) / BigInt(1e12) : (principal * assetData.bRate) / BigInt(1e12);
        if (balance > 0) {
            const assetWorth = (balance * prices.get(key)!) / 10n ** assetConfig.decimals;
            totalLimit += (assetWorth * assetConfig.liquidationThreshold) / masterConstants.ASSET_COEFFICIENT_SCALE;
            if (assetWorth > gCollateralValue) {
                gCollateralValue = assetWorth;
                gCollateralAsset = key;
            }
        } else if (balance < 0) {
            const assetWorth = (-balance * prices.get(key)!) / 10n ** assetConfig.decimals;
            totalDebt += assetWorth;
            if (assetWorth > gLoanValue) {
                gLoanValue = assetWorth;
                gLoanAsset = key;
            }
        }
    }
    
    if (totalLimit < totalDebt) {
        const gLoanAssetPrice = prices.get(gLoanAsset)!;
        const values: bigint[] = [];
        const gCollateralAssetConfig = assetsConfig.get(gCollateralAsset)!;
        const gLoanAssetConfig = assetsConfig.get(gLoanAsset)!;
        const liquidationBonus = gCollateralAssetConfig.liquidationBonus;
        const loanDecimal = 10n ** gLoanAssetConfig.decimals;
        values.push(
            (bigIntMax(gCollateralValue / 2n, bigIntMin(gCollateralValue, 10_000_000_000n)) *
                loanDecimal *
                masterConstants.ASSET_COEFFICIENT_SCALE) /
                liquidationBonus /
                gLoanAssetPrice,
        );
        values.push((gLoanValue * loanDecimal) / gLoanAssetPrice);

        const liquidationAmount = (bigIntMin(...values) as bigint) - 5n;
        const gCollateralAssetPrice: bigint = prices.get(gCollateralAsset)!;
        const collateralDecimal = 10n ** gCollateralAssetConfig.decimals;
        let minCollateralAmount =
            (((liquidationAmount * gLoanAssetPrice * liquidationBonus) / 10000n) * collateralDecimal) /
                gCollateralAssetPrice /
                loanDecimal -
            10n;
        minCollateralAmount = (minCollateralAmount * 97n) / 100n;
        if (minCollateralAmount / collateralDecimal >= 0n) {  // todo back to 1
            return {
                greatestCollateralAsset: gCollateralAsset,
                greatestCollateralValue: gCollateralValue,
                greatestLoanAsset: gLoanAsset,
                greatestLoanValue: gLoanValue,
                totalDebt,
                totalLimit,
                liquidable: true,
                liquidationAmount,
                minCollateralAmount,
            };
        }
    }

    return {
        greatestCollateralAsset: gCollateralAsset,
        greatestCollateralValue: gCollateralValue,
        greatestLoanAsset: gLoanAsset,
        greatestLoanValue: gLoanValue,
        totalDebt,
        totalLimit,
        liquidable: false,
    };
}

export function predictHealthFactor(args: PredictHealthFactorArgs): number {
    const liquidationData = calculateLiquidationData(args.assetsConfig, args.assetsData, args.balances, args.prices, args.masterConstants);
    const tokenHash = sha256Hash(args.tokenSymbol);
    
    const assetConfig = args.assetsConfig.get(tokenHash)!;
    const assetPrice = Number(args.prices.get(tokenHash)!);
   
    let totalLimit = Number(liquidationData.totalLimit);
    let totalBorrow = Number(liquidationData.totalDebt);

    const currentAmount = args.amount;

    const decimals = Number(assetConfig.decimals)

    const currentBalance = assetPrice * Number(currentAmount) / Math.pow(10, decimals);
    const changeType = args.balanceChangeType;

    if (currentAmount != null && !Number.isNaN(currentAmount) &&
             Number.isFinite(currentAmount) && currentAmount != 0n) { 
        if (changeType == BalanceChangeType.Borrow) {
            totalBorrow += currentBalance * (1 + Number(assetConfig.originationFee) / Number(args.masterConstants.ASSET_ORIGINATION_FEE_SCALE));
        } else if (changeType == BalanceChangeType.Repay) {
            totalBorrow -= currentBalance;
        } else if (changeType == BalanceChangeType.Withdraw) {
            totalLimit -= currentBalance * Number(assetConfig.liquidationThreshold) / Number(args.masterConstants.ASSET_COEFFICIENT_SCALE);
        } else if (changeType == BalanceChangeType.Supply) {
            totalLimit += currentBalance * Number(assetConfig.liquidationThreshold) / Number(args.masterConstants.ASSET_COEFFICIENT_SCALE);
        }
    }
    if (Number(totalLimit) == 0) {
        return 1;
    }

    return Math.min(Math.max(1 - totalBorrow / totalLimit, 0), 1);  // let's limit a result to zero below and one above
}
