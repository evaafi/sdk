import { AssetConfig, AssetData, AssetInterest, ExtendedAssetData } from '../types/Master';
import { MASTER_CONSTANTS } from '../constants';
import { Dictionary } from '@ton/core';
import { BalanceType, LiquidationData, UserBalance } from '../types/User';

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

export function calculatePresentValue(index: bigint, principalValue: bigint): bigint {
    return (principalValue * index) / MASTER_CONSTANTS.FACTOR_SCALE;
}

export function calculateCurrentRates(assetConfig: AssetConfig, assetData: AssetData) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeElapsed = now - assetData.lastAccural;
    const { supplyInterest, borrowInterest } = calculateAssetInterest(assetConfig, assetData);

    if (timeElapsed > 0) {
        const updatedSRate =
            assetData.sRate + mulFactor(MASTER_CONSTANTS.FACTOR_SCALE, assetData.sRate, supplyInterest * timeElapsed);
        const updatedBRate =
            assetData.bRate + mulFactor(MASTER_CONSTANTS.FACTOR_SCALE, assetData.bRate, borrowInterest * timeElapsed);
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
    assetsConfigDict: Dictionary<bigint, AssetConfig>,
    assetsDataDict: Dictionary<bigint, AssetData>,
    assetId: bigint,
): ExtendedAssetData {
    const config = assetsConfigDict.get(assetId);
    const data = assetsDataDict.get(assetId);

    if (!data || !config) {
        throw new Error('Asset Data or Config is not accessible');
    }

    const { sRate, bRate, supplyInterest, borrowInterest, now } = calculateCurrentRates(config, data);
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

export function calculateAssetInterest(assetConfig: AssetConfig, assetData: AssetData): AssetInterest {
    const totalSupply = calculatePresentValue(assetData.sRate, assetData.totalSupply);
    const totalBorrow = calculatePresentValue(assetData.bRate, assetData.totalBorrow);
    let utilization = 0n;
    let supplyInterest = 0n;
    let borrowInterest = 0n;

    if (totalSupply !== 0n) {
        utilization = (totalBorrow * MASTER_CONSTANTS.FACTOR_SCALE) / totalSupply;
    }

    if (utilization <= assetConfig.targetUtilization) {
        borrowInterest =
            assetConfig.baseBorrowRate +
            mulFactor(MASTER_CONSTANTS.FACTOR_SCALE, assetConfig.borrowRateSlopeLow, utilization);
    } else {
        borrowInterest =
            assetConfig.baseBorrowRate +
            mulFactor(MASTER_CONSTANTS.FACTOR_SCALE, assetConfig.borrowRateSlopeLow, assetConfig.targetUtilization) +
            mulFactor(
                MASTER_CONSTANTS.FACTOR_SCALE,
                assetConfig.borrowRateSlopeHigh,
                utilization - assetConfig.targetUtilization,
            );
    }

    const reserveFactor = 10n;
    const reserveScale = 100n;
    supplyInterest = mulDiv(
        mulDiv(borrowInterest, utilization, MASTER_CONSTANTS.FACTOR_SCALE),
        reserveScale - reserveFactor,
        reserveScale,
    );

    return {
        supplyInterest,
        borrowInterest,
    };
}

export function getAvailableToBorrow(
    assetsConfig: Dictionary<bigint, AssetConfig>,
    assetsData: Dictionary<bigint, ExtendedAssetData>,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
): bigint {
    let borrowLimit = 0n;
    let borrowAmount = 0n;

    for (const assetID of principals.keys()) {
        const assetConfig = assetsConfig.get(assetID) as AssetConfig;
        const assetData = assetsData.get(assetID) as ExtendedAssetData;
        const price = prices.get(assetID) as bigint;
        const principal = principals.get(assetID) as bigint;

        if (principal < 0) {
            borrowAmount += (calculatePresentValue(assetData.bRate, -principal) * price) / 10n ** assetConfig.decimals;
        } else if (principal > 0) {
            borrowLimit +=
                (calculatePresentValue(assetData.sRate, principal) * price * assetConfig.collateralFactor) /
                10n ** assetConfig.decimals /
                MASTER_CONSTANTS.ASSET_COEFFICIENT_SCALE;
        }
    }

    return borrowLimit - borrowAmount;
}

export function presentValue(sRate: bigint, bRate: bigint, principalValue: bigint): UserBalance {
    if (principalValue > 0) {
        return {
            amount: calculatePresentValue(sRate, principalValue),
            type: BalanceType.supply,
        };
    } else if (principalValue < 0) {
        return {
            amount: calculatePresentValue(bRate, -principalValue),
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
    assetsConfig: Dictionary<bigint, AssetConfig>,
    assetsData: Dictionary<bigint, ExtendedAssetData>,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
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
            totalLimit += (assetWorth * assetConfig.liquidationThreshold) / MASTER_CONSTANTS.ASSET_COEFFICIENT_SCALE;
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
        const liquidationBonus = gLoanAssetConfig.liquidationBonus;
        const loanDecimal = 10n ** gLoanAssetConfig.decimals;
        values.push(
            (bigIntMax(gCollateralValue / 2n, bigIntMin(gCollateralValue, 10_000_000_000n)) *
                loanDecimal *
                MASTER_CONSTANTS.ASSET_COEFFICIENT_SCALE) /
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
        if (minCollateralAmount / collateralDecimal >= 1n) {
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
