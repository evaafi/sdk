import {
    AgregatedBalances,
    AssetConfig,
    AssetData,
    AssetInterest,
    ExtendedAssetData,
    ExtendedAssetsConfig,
    ExtendedAssetsData,
    MasterConstants,
    PoolAssetConfig,
    PoolConfig
} from '../types/Master';
import { Dictionary } from '@ton/core';
import {
    BalanceChangeType,
    BalanceType, HealthParamsArgs,
    LiquidationData,
    PredictHealthFactorArgs,
    UserBalance
} from '../types/User';
import { sha256Hash } from '../utils/sha256BigInt';
import { UNDEFINED_ASSET } from '../constants/assets';

export function mulFactor(decimal: bigint, a: bigint, b: bigint): bigint {
    return (a * b) / decimal;
}

export function mulDiv(x: bigint, y: bigint, z: bigint): bigint {
    return (x * y) / z;
}

export function mulDivC(x: bigint, y: bigint, z: bigint): bigint {
    const mul = x * y;
    return mul / z + (mul % z ? 1n : 0n);
}

export function bigAbs(value: bigint) {
    return value > 0n ? value : -value;
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

export function checkNotInDebtAtAll(principals: Dictionary<bigint, bigint>): boolean {
    return principals.values().every(x => x >= 0n);
}

export function getAgregatedBalances(
    assetsData: ExtendedAssetsData,
    assetsConfig: ExtendedAssetsConfig,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    masterConstants: MasterConstants,
  ): AgregatedBalances {
    let user_total_supply = 0n;
    let user_total_borrow = 0n;
  
    for (const [assetId, principal] of principals) {
        if (principal) {
    
        if (!prices.has(assetId)) {
          return {totalSupply: 0n, totalBorrow: 0n};
        }
        const price = prices.get(assetId)!;
        const assetData = assetsData.get(assetId)!;
        const assetConfig = assetsConfig.get(assetId)!;
  
        if (principal < 0) {
          user_total_borrow += presentValue(assetData.sRate, assetData.bRate, principal, masterConstants).amount * price / 10n ** assetConfig.decimals;
        } else {
          user_total_supply += presentValue(assetData.sRate, assetData.bRate, principal, masterConstants).amount * price / 10n ** assetConfig.decimals;
        }
  
      }
    }
    return {totalSupply: user_total_supply, totalBorrow: user_total_borrow};
  }

export function calculateMaximumWithdrawAmount(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    masterConstants: MasterConstants,
    assetId: bigint,
): bigint {
    let withdrawAmountMax = 0n;

    const assetConfig = assetsConfig.get(assetId) as AssetConfig;
    const assetData = assetsData.get(assetId) as ExtendedAssetData;
    const oldPrincipal = principals.get(assetId) as bigint;

    if (oldPrincipal > assetConfig.dust) {
        const oldPresentValue = presentValue(assetData.sRate, assetData.bRate, oldPrincipal, masterConstants);
        if(checkNotInDebtAtAll(principals)) {
            withdrawAmountMax = oldPresentValue.amount; 
        } else {
            if (!prices.has(assetId)) {
                return 0n;
            }

            const borrowable = getAvailableToBorrow(assetsConfig, assetsData, principals, prices, masterConstants);
            const price = prices.get(assetId) as bigint;

            let maxAmountToReclaim = 0n;

            if (assetConfig.collateralFactor == 0n) {
                maxAmountToReclaim = oldPresentValue.amount;
            }
            else if (price > 0) {
                maxAmountToReclaim =
                    mulDiv(
                        mulDivC(borrowable, masterConstants.ASSET_COEFFICIENT_SCALE, assetConfig.collateralFactor),
                        10n ** assetConfig.decimals, price
                    );
            }
          
            withdrawAmountMax = bigIntMin(
                maxAmountToReclaim,
                oldPresentValue.amount
            );
        }
    } else {
        if (!prices.has(assetId)) {
            return 0n;
        }

        const price = prices.get(assetId) as bigint;

        return getAvailableToBorrow(assetsConfig, assetsData, principals, prices, masterConstants) * (10n ** assetConfig.decimals) / price;
    }

    return withdrawAmountMax;
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
            mulDivC(
                mulDivC(calculatePresentValue(assetData.sRate, principal, masterConstants), price, 10n ** assetConfig.decimals),
                assetConfig.collateralFactor,
                masterConstants.ASSET_COEFFICIENT_SCALE);
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

export function calculateHealthParams(args: HealthParamsArgs) {
    const {
        principals, prices,
        assetsData, assetsConfig,
        poolConfig
    } = args;

    const { ASSET_SRATE_SCALE, ASSET_BRATE_SCALE, ASSET_COEFFICIENT_SCALE } = poolConfig.masterConstants;

    let totalSupply = 0n;
    let totalDebt = 0n;
    let totalLimit = 0n;

    for (const asset of poolConfig.poolAssetsConfig) {
        if (!principals.has(asset.assetId)) continue;
        const principal = principals.get(asset.assetId)!;

        const assetConfig = assetsConfig.get(asset.assetId)!;
        if (!assetConfig) throw (`No config for ${asset.name}:${asset.assetId}`);

        const assetData = assetsData.get(asset.assetId)!;
        if (!assetData) throw (`No data for asset ${asset.name}:${asset.assetId}`);

        const balance = principal > 0 ?
            (principal * assetData.sRate) / ASSET_SRATE_SCALE :
            (principal * assetData.bRate) / ASSET_BRATE_SCALE;

        const assetWorth = (bigAbs(balance) * prices.get(asset.assetId)!) / 10n ** assetConfig.decimals;
        if (balance > 0) {
            totalSupply += assetWorth;
            totalLimit += (assetWorth * assetConfig.liquidationThreshold) / ASSET_COEFFICIENT_SCALE;
        } else if (balance < 0) {
            totalDebt += assetWorth;
        }
    }

    return { totalDebt, totalLimit, totalSupply };
}

/**
 * Check if the user is subject to liquidation
 * @param args
 */
export function isLiquidable(args: {
    assetsData: ExtendedAssetsData, assetsConfig: ExtendedAssetsConfig,
    principals: Dictionary<bigint, bigint>, prices: Dictionary<bigint, bigint>,
    poolConfig: PoolConfig
}): boolean {
    const { totalDebt, totalLimit } = calculateHealthParams(args);
    return totalLimit < totalDebt;
}

export function isBadDebt(supplyAmount: bigint, borrowAmount: bigint, liquidationBonus: bigint, masterConstants: MasterConstants) {
    if (borrowAmount === 0n) {
        return false;
    }
    return supplyAmount * masterConstants.ASSET_COEFFICIENT_SCALE < liquidationBonus * borrowAmount;
}

export function addReserve(amount: bigint, loanScale: bigint, reserveFactor: bigint): bigint {
    return amount * loanScale / (loanScale - reserveFactor);
}

/**
 * Calculates liquidation amount and corresponding collateral amount
 * @param supplyAmount user total supply worth amount
 * @param borrowAmount user total borrow worth amount
 * @param masterConstants evaa master contract constants
 * @param loanAsset loan asset pool config
 * @param collateralAsset collateral asset pool config
 * @param principalsDict user principals
 * @param assetsDataDict assets data collection
 * @param assetsConfigDict assets config collection
 * @param pricesDict assets prices
 */
export function calculateLiquidationAmounts(
    loanAsset: PoolAssetConfig, collateralAsset: PoolAssetConfig,
    supplyAmount: bigint, borrowAmount: bigint, // from calculate health params
    principalsDict: Dictionary<bigint, bigint>, pricesDict: Dictionary<bigint, bigint>,
    assetsDataDict: ExtendedAssetsData, assetsConfigDict: ExtendedAssetsConfig, masterConstants: MasterConstants
): { liquidationAmount: bigint, collateralAmount: bigint } {
    const loanConfig = assetsConfigDict.get(loanAsset.assetId);
    const loanData = assetsDataDict.get(loanAsset.assetId);
    const loanPrice = pricesDict.get(loanAsset.assetId);
    const loanPrinciple = principalsDict.get(loanAsset.assetId);

    const collateralConfig = assetsConfigDict.get(collateralAsset.assetId);
    const collateralData = assetsDataDict.get(collateralAsset.assetId);
    const collateralPrice = pricesDict.get(collateralAsset.assetId);
    const collateralPrinciple = principalsDict.get(collateralAsset.assetId);

    if (!loanConfig || !loanData || !loanPrice || !loanPrinciple ||
        !collateralConfig || !collateralData || !collateralPrice || !collateralPrinciple) {
        return { liquidationAmount: 0n, collateralAmount: 0n };
    }

    const loanScale = 10n ** loanConfig.decimals;
    const collateralScale = 10n ** collateralConfig.decimals;
    const lbScale = masterConstants.ASSET_LIQUIDATION_BONUS_SCALE;
    const worthThreshold = masterConstants.COLLATERAL_WORTH_THRESHOLD;
    const reserveFactor = loanConfig.liquidationReserveFactor;

    const liquidationBonus = collateralConfig.liquidationBonus;
    const collateralPresent = calculatePresentValue(collateralData.sRate, collateralPrinciple, masterConstants);
    const loanPresent = calculatePresentValue(loanData.bRate, loanPrinciple, masterConstants);

    if (isBadDebt(supplyAmount, borrowAmount, liquidationBonus, masterConstants)) {
        // if bad debt, take all collateral, and need to send quoted loan amount
        let liquidationAmount = collateralPresent * collateralPrice / collateralScale *
            loanScale * lbScale / liquidationBonus / loanPrice;

        liquidationAmount = addReserve(liquidationAmount, loanScale, reserveFactor);

        return { liquidationAmount, collateralAmount: collateralPresent };
    }

    let allowedCollateral = bigIntMax(collateralPresent / 2n, bigIntMin(collateralPresent, worthThreshold));
    let liquidationAmount = bigIntMin(loanPresent, allowedCollateral * lbScale / liquidationBonus) * loanScale / loanPrice;

    const collateralAmount = liquidationAmount * loanPrice *
        liquidationBonus / lbScale * collateralScale / collateralPrice / loanScale;

    liquidationAmount = addReserve(liquidationAmount, loanScale, reserveFactor);

    return { liquidationAmount, collateralAmount };
}

/**
 *
 * @param assetsConfig assets config dictionary
 * @param assetsData assets data dictionary
 * @param principals principals dictionary
 * @param prices prices dictionary
 * @param poolConfig pool config
 * @returns can return UNDEFINED_ASSET if there are no assets
 */
export function calculateLiquidationData(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    poolConfig: PoolConfig,
): LiquidationData {
    let collateralValue = 0n;
    let collateralAsset = UNDEFINED_ASSET;
    let loanValue = 0n;
    let loanAsset = UNDEFINED_ASSET;
    let totalDebt = 0n;
    let totalLimit = 0n;

    const {
        ASSET_SRATE_SCALE, ASSET_BRATE_SCALE,
        COLLATERAL_WORTH_THRESHOLD
    } = poolConfig.masterConstants;

    for (const asset of poolConfig.poolAssetsConfig) {
        const principal = principals.get(asset.assetId)!;
        if (!principal) continue;
        const assetConfig = assetsConfig.get(asset.assetId)!;
        const assetData = assetsData.get(asset.assetId)!;
        const balance = principal > 0 ?
            (principal * assetData.sRate) / ASSET_SRATE_SCALE :
            (principal * assetData.bRate) / ASSET_BRATE_SCALE;

        const assetWorth = (bigAbs(balance) * prices.get(asset.assetId)!) / 10n ** assetConfig.decimals;
        if (balance > 0) {
            totalLimit += (assetWorth * assetConfig.liquidationThreshold) / poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE;
            // get the greatest collateral
            if (assetWorth > collateralValue) {
                collateralValue = assetWorth;
                collateralAsset = asset;
            }
        } else if (balance < 0) {
            totalDebt += assetWorth;
            // get the greatest loan
            if (assetWorth > loanValue) {
                loanValue = assetWorth;
                loanAsset = asset;
            }
        }
    }

    if (collateralAsset.assetId !== UNDEFINED_ASSET.assetId && totalLimit < totalDebt) {
        const loanAssetPrice = prices.get(loanAsset.assetId)!;
        const values: bigint[] = [];
        const collateralAssetConfig = assetsConfig.get(collateralAsset.assetId)!;
        const loanAssetConfig = assetsConfig.get(loanAsset.assetId)!;
        const liquidationBonus = collateralAssetConfig.liquidationBonus;
        const loanScale = 10n ** loanAssetConfig.decimals;
        values.push(
            (bigIntMax(collateralValue / 2n, bigIntMin(collateralValue, COLLATERAL_WORTH_THRESHOLD)) *
                loanScale *
                poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE) /
            liquidationBonus /
            loanAssetPrice
        );
        values.push((loanValue * loanScale) / loanAssetPrice);

        const liquidationAmount = (bigIntMin(...values) as bigint) - 5n;
        const collateralAssetPrice: bigint = prices.get(collateralAsset.assetId)!;
        const collateralDecimal = 10n ** collateralAssetConfig.decimals;
        let minCollateralAmount =
            (((liquidationAmount * loanAssetPrice * liquidationBonus) / poolConfig.masterConstants.ASSET_LIQUIDATION_BONUS_SCALE) * collateralDecimal) /
            collateralAssetPrice /
            loanScale -
            10n;
        minCollateralAmount = (minCollateralAmount * 97n) / 100n;
        if (minCollateralAmount / collateralDecimal >= 0n) {  // todo back to 1
            return {
                greatestCollateralAsset: collateralAsset,
                greatestCollateralValue: collateralValue,
                greatestLoanAsset: loanAsset,
                greatestLoanValue: loanValue,
                totalDebt,
                totalLimit,
                liquidable: true,
                liquidationAmount: addReserve(liquidationAmount, loanScale, loanAssetConfig.liquidationReserveFactor),
                minCollateralAmount
            };
        }
    }

    return {
        greatestCollateralAsset: collateralAsset,
        greatestCollateralValue: collateralValue,
        greatestLoanAsset: loanAsset,
        greatestLoanValue: loanValue,
        totalDebt,
        totalLimit,
        liquidable: false,
    };
}

export function predictHealthFactor(args: PredictHealthFactorArgs): number {
    const healthParams = calculateHealthParams(args);
    const assetId = args.asset.assetId;

    const assetConfig = args.assetsConfig.get(assetId)!;
    const assetPrice = Number(args.prices.get(assetId)!);

    let totalLimit = Number(healthParams.totalLimit);
    let totalBorrow = Number(healthParams.totalDebt);

    const currentAmount = args.amount;

    const decimals = Number(assetConfig.decimals)

    const currentBalance = assetPrice * Number(currentAmount) / Math.pow(10, decimals);
    const changeType = args.balanceChangeType;

    if (currentAmount != null && currentAmount != 0n) {
        if (changeType == BalanceChangeType.Borrow) {
            totalBorrow += currentBalance * (1 + Number(assetConfig.originationFee) / Number(args.poolConfig.masterConstants.ASSET_ORIGINATION_FEE_SCALE));
        } else if (changeType == BalanceChangeType.Repay) {
            totalBorrow -= currentBalance;
        } else if (changeType == BalanceChangeType.Withdraw) {
            totalLimit -= currentBalance * Number(assetConfig.liquidationThreshold) / Number(args.poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE);
        } else if (changeType == BalanceChangeType.Supply) {
            totalLimit += currentBalance * Number(assetConfig.liquidationThreshold) / Number(args.poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE);
        }
    }
    if (Number(totalLimit) == 0) {
        return 1;
    }

    return Math.min(Math.max(1 - totalBorrow / totalLimit, 0), 1);  // let's limit a result to zero below and one above
}
