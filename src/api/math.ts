import { Dictionary } from '@ton/core';
import type {
    AgregatedBalances,
    AssetApy,
    AssetConfig,
    AssetData,
    AssetInterest,
    ExtendedAssetData,
    ExtendedAssetsConfig,
    ExtendedAssetsData,
    MasterConstants,
    PoolConfig,
} from '../types/Master';
import { UNDEFINED_ASSET } from '../constants/assets';
import {
    BalanceChangeType,
    BalanceType,
    UserData,
    UserDataActive,
    UserLiteData,
    type HealthParamsArgs,
    type LiquidationData,
    type PredictAPYArgs,
    type PredictHealthFactorArgs,
    type UserBalance,
} from '../types/User';
import { addReserve, isBadDebt } from './liquidation';

export function mulFactor(decimal: bigint, a: bigint, b: bigint): bigint {
    return (a * b) / decimal;
}

export function mulDiv(x: bigint, y: bigint, z: bigint): bigint {
    return (x * y) / z;
}

export function mulDivC(x: bigint, y: bigint, z: bigint): bigint {
    //const mul = x * y;
    //return mul / z + (mul % z ? 1n : 0n);
    return BigInt(Math.ceil(Number(x * y) / Number(z)));
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

export const BigMath = { mulFactor, mulDiv, mulDivC, abs: bigAbs, min: bigIntMin, max: bigIntMax };

export function calculatePresentValue(index: bigint, principalValue: bigint, masterConstants: MasterConstants): bigint {
    return (principalValue * index) / masterConstants.FACTOR_SCALE;
}

export function getAssetLiquidityMinusReserves(assetData: AssetData, masterConstants: MasterConstants) {
    const total_supply = calculatePresentValue(assetData.sRate, assetData.totalSupply, masterConstants);
    const total_borrow = calculatePresentValue(assetData.bRate, assetData.totalBorrow, masterConstants);
    return bigIntMin(total_supply - total_borrow, assetData.balance);
}

export function calculateCurrentRates(
    assetConfig: AssetConfig,
    assetData: AssetData,
    masterConstants: MasterConstants,
) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeElapsed = now - assetData.lastAccrual;
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
    masterConstants: MasterConstants,
): ExtendedAssetData {
    const config = assetsConfigDict.get(assetId);
    const data = assetsDataDict.get(assetId);

    if (!data || !config) {
        throw new Error('Asset Data or Config is not accessible');
    }

    const { sRate, bRate, supplyInterest, borrowInterest, now } = calculateCurrentRates(config, data, masterConstants);
    data.sRate = sRate || 0n;
    data.bRate = bRate || 0n;
    data.lastAccrual = now;

    const supplyApy = (1 + (Number(supplyInterest) / 1e12) * 24 * 3600) ** 365 - 1;
    const borrowApy = (1 + (Number(borrowInterest) / 1e12) * 24 * 3600) ** 365 - 1;

    return {
        ...data,
        ...{ supplyInterest, borrowInterest },
        ...{ supplyApy, borrowApy },
    };
}

export function calculateAssetInterest(
    assetConfig: AssetConfig,
    assetData: AssetData,
    masterConstants: MasterConstants,
): AssetInterest {
    const totalSupply = calculatePresentValue(assetData.sRate, assetData.totalSupply, masterConstants);
    const totalBorrow = calculatePresentValue(assetData.bRate, assetData.totalBorrow, masterConstants);

    return calculateInterestWithSupplyBorrow(totalSupply, totalBorrow, assetConfig, masterConstants);
}

export function calculateInterestWithSupplyBorrow(
    totalSupply: bigint,
    totalBorrow: bigint,
    assetConfig: AssetConfig,
    masterConstants: MasterConstants,
): AssetInterest {
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
    return principals.values().every((x) => x >= 0n);
}

export function determineHeCategory(
    assetsConfig: ExtendedAssetsConfig,
    principals: Dictionary<bigint, bigint>,
    poolConfig?: PoolConfig,
): number {
    const heCategoryByAssetId = new Map<bigint, number>();
    if (poolConfig) {
        for (const heConfig of poolConfig.poolAssetsHEConfig) {
            for (const asset of heConfig.assets) {
                heCategoryByAssetId.set(asset.assetId, heConfig.heCategory);
            }
        }
    }

    let heCategory = -1;

    for (const [assetID, principal] of principals) {
        if (principal >= 0n) {
            continue;
        }

        const heCategoryForAsset = heCategoryByAssetId.get(assetID) ?? assetsConfig.get(assetID)?.heCategory ?? 0;
        if (heCategoryForAsset <= 0) {
            return -1;
        }

        if (heCategory === -1) {
            heCategory = heCategoryForAsset;
            continue;
        }

        if (heCategory !== heCategoryForAsset) {
            return -1;
        }
    }

    return heCategory > 0 ? heCategory : -1;
}

export function calculateRepayToExitEMode(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    poolConfig: PoolConfig,
): {
    activeHeCategory: number;
    requiredRepayInUsd: bigint;
    repayAmounts: Dictionary<bigint, bigint>;
    enoughPriceData: boolean;
} {
    const activeHeCategory = determineHeCategory(assetsConfig, principals, poolConfig);
    const repayAmounts = Dictionary.empty<bigint, bigint>();

    if (activeHeCategory <= 0) {
        return { activeHeCategory: -1, requiredRepayInUsd: 0n, repayAmounts, enoughPriceData: true };
    }

    const availableToBorrowStandard = getAvailableToBorrow(
        assetsConfig,
        assetsData,
        principals,
        prices,
        poolConfig.masterConstants,
    );
    const requiredRepayInUsd = bigIntMax(0n, -availableToBorrowStandard);

    if (requiredRepayInUsd === 0n) {
        return {
            activeHeCategory,
            requiredRepayInUsd,
            repayAmounts,
            enoughPriceData: true,
        };
    }

    let totalDebtWorth = 0n;
    const debtEntries: Array<{
        assetID: bigint;
        debtAmount: bigint;
        debtWorth: bigint;
        decimals: bigint;
        price: bigint;
    }> = [];

    for (const [assetID, principal] of principals) {
        if (principal >= 0n) {
            continue;
        }

        if (!prices.has(assetID)) {
            return {
                activeHeCategory,
                requiredRepayInUsd,
                repayAmounts: Dictionary.empty<bigint, bigint>(),
                enoughPriceData: false,
            };
        }

        const assetConfig = assetsConfig.get(assetID);
        const assetData = assetsData.get(assetID);
        if (!assetData || !assetConfig) {
            continue;
        }

        const price = prices.get(assetID)!;
        const debtAmount = calculatePresentValue(assetData.bRate, -principal, poolConfig.masterConstants);
        const debtWorth = mulDiv(debtAmount, price, 10n ** assetConfig.decimals);

        totalDebtWorth += debtWorth;
        debtEntries.push({ assetID, debtAmount, debtWorth, decimals: assetConfig.decimals, price });
    }

    if (totalDebtWorth === 0n) {
        return {
            activeHeCategory,
            requiredRepayInUsd,
            repayAmounts,
            enoughPriceData: true,
        };
    }

    let distributedRepayWorth = 0n;
    debtEntries.forEach((entry, index) => {
        const repayWorth =
            index === debtEntries.length - 1
                ? requiredRepayInUsd - distributedRepayWorth
                : mulDiv(requiredRepayInUsd, entry.debtWorth, totalDebtWorth);

        distributedRepayWorth += repayWorth;

        const repayAmount = bigIntMin(entry.debtAmount, mulDivC(repayWorth, 10n ** entry.decimals, entry.price));
        if (repayAmount > 0n) {
            repayAmounts.set(entry.assetID, repayAmount);
        }
    });

    if (distributedRepayWorth < requiredRepayInUsd && debtEntries.length > 0) {
        const lastEntry = debtEntries[debtEntries.length - 1];
        const currentRepayAmount = repayAmounts.get(lastEntry.assetID) ?? 0n;
        if (currentRepayAmount < lastEntry.debtAmount) {
            repayAmounts.set(lastEntry.assetID, bigIntMin(lastEntry.debtAmount, currentRepayAmount + 1n));
        }
    }

    return {
        activeHeCategory,
        requiredRepayInUsd,
        repayAmounts,
        enoughPriceData: true,
    };
}

export function getAvailableToBorrowWithEMode(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    masterConstants: MasterConstants,
    poolConfig?: PoolConfig,
): { availableToBorrow: bigint; heCategory: number } {
    const heCategoryByAssetId = new Map<bigint, number>();
    if (poolConfig) {
        for (const heConfig of poolConfig.poolAssetsHEConfig) {
            for (const asset of heConfig.assets) {
                heCategoryByAssetId.set(asset.assetId, heConfig.heCategory);
            }
        }
    }

    const calculateForHeCategory = (heCategory: number): bigint => {
        let borrowLimit = 0n;
        let borrowAmount = 0n;

        for (const assetID of principals.keys()) {
            const principal = principals.get(assetID) as bigint;

            if (principal == 0n) {
                continue;
            }

            if (!prices.has(assetID)) {
                return 0n;
            }

            const assetConfig = assetsConfig.get(assetID) as AssetConfig;
            const assetData = assetsData.get(assetID) as ExtendedAssetData;
            const price = prices.get(assetID) as bigint;

            if (principal < 0n) {
                borrowAmount += mulDivC(
                    calculatePresentValue(assetData.bRate, -principal, masterConstants),
                    price,
                    10n ** assetConfig.decimals,
                );
            } else {
                const suppliedAssetInDollars = mulDiv(
                    calculatePresentValue(assetData.sRate, principal, masterConstants),
                    price,
                    10n ** assetConfig.decimals,
                );

                const heCategoryForAsset = heCategoryByAssetId.get(assetID) ?? assetConfig.heCategory;

                const collateralFactor =
                    heCategory > 0 && heCategoryForAsset === heCategory
                        ? assetConfig.heCollateralFactor
                        : assetConfig.collateralFactor;

                borrowLimit += mulDiv(
                    suppliedAssetInDollars,
                    collateralFactor,
                    masterConstants.ASSET_COEFFICIENT_SCALE,
                );
            }
        }

        return borrowLimit - borrowAmount;
    };

    const activeHeCategory = determineHeCategory(assetsConfig, principals, poolConfig);
    if (activeHeCategory > 0) {
        return {
            availableToBorrow: calculateForHeCategory(activeHeCategory),
            heCategory: activeHeCategory,
        };
    }

    const availableToBorrowWithoutEmode = calculateForHeCategory(0);
    if (!checkNotInDebtAtAll(principals)) {
        return {
            availableToBorrow: availableToBorrowWithoutEmode,
            heCategory: 0,
        };
    }

    const availableHeCategories = new Set<number>();
    if (poolConfig && poolConfig.poolAssetsHEConfig.length > 0) {
        for (const heConfig of poolConfig.poolAssetsHEConfig) {
            const hasSupplyInCategory = heConfig.assets.some((asset) => (principals.get(asset.assetId) ?? 0n) > 0n);
            if (hasSupplyInCategory && heConfig.heCategory > 0) {
                availableHeCategories.add(heConfig.heCategory);
            }
        }
    } else {
        for (const [assetID, principal] of principals) {
            if (principal <= 0n) {
                continue;
            }
            const heCategory = (assetsConfig.get(assetID) as AssetConfig).heCategory;
            if (heCategory > 0) {
                availableHeCategories.add(heCategory);
            }
        }
    }

    let bestHeCategory = 0;
    let bestAvailableToBorrow = availableToBorrowWithoutEmode;
    for (const heCategory of availableHeCategories) {
        const availableToBorrow = calculateForHeCategory(heCategory);
        if (availableToBorrow > bestAvailableToBorrow) {
            bestAvailableToBorrow = availableToBorrow;
            bestHeCategory = heCategory;
        }
    }

    return {
        availableToBorrow: bestAvailableToBorrow,
        heCategory: bestHeCategory,
    };
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
                return { totalSupply: 0n, totalBorrow: 0n };
            }
            const price = prices.get(assetId)!;
            const assetData = assetsData.get(assetId)!;
            const assetConfig = assetsConfig.get(assetId)!;

            if (principal < 0) {
                user_total_borrow +=
                    (presentValue(assetData.sRate, assetData.bRate, principal, masterConstants).amount * price) /
                    10n ** assetConfig.decimals;
            } else {
                user_total_supply +=
                    (presentValue(assetData.sRate, assetData.bRate, principal, masterConstants).amount * price) /
                    10n ** assetConfig.decimals;
            }
        }
    }
    return { totalSupply: user_total_supply, totalBorrow: user_total_borrow };
}

export function calculateMaximumWithdrawAmount(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    poolConfig: PoolConfig,
    assetId: bigint,
): bigint {
    let withdrawAmountMax = 0n;

    const assetConfig = assetsConfig.get(assetId) as AssetConfig;
    const assetData = assetsData.get(assetId) as ExtendedAssetData;
    const oldPrincipal = principals.get(assetId) as bigint;

    if (oldPrincipal > assetConfig.dust) {
        const oldPresentValue = presentValue(
            assetData.sRate,
            assetData.bRate,
            oldPrincipal,
            poolConfig.masterConstants,
        );
        if (checkNotInDebtAtAll(principals)) {
            withdrawAmountMax = oldPresentValue.amount;
        } else {
            if (!prices.has(assetId)) {
                return 0n;
            }

            const borrowable = getAvailableToBorrow(
                assetsConfig,
                assetsData,
                principals,
                prices,
                poolConfig.masterConstants,
            );
            const price = prices.get(assetId) as bigint;

            let maxAmountToReclaim = 0n;

            if (assetConfig.collateralFactor == 0n) {
                maxAmountToReclaim = oldPresentValue.amount;
            } else if (price > 0) {
                const { availableToBorrow: borrowable, heCategory } = getAvailableToBorrowWithEMode(
                    assetsConfig,
                    assetsData,
                    principals,
                    prices,
                    poolConfig.masterConstants,
                    poolConfig,
                );

                const collateralFactor =
                    heCategory > 0 && assetConfig.heCategory === heCategory
                        ? assetConfig.heCollateralFactor
                        : assetConfig.collateralFactor;

                maxAmountToReclaim = bigIntMax(
                    0n,
                    mulDiv(
                        mulDiv(borrowable, poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE, collateralFactor),
                        10n ** assetConfig.decimals,
                        price,
                    ) -
                        calculatePresentValue(assetData.sRate, assetConfig.dust, poolConfig.masterConstants) / 2n,
                );
            }

            withdrawAmountMax = bigIntMin(maxAmountToReclaim, oldPresentValue.amount);
        }
    } else {
        if (!prices.has(assetId)) {
            return 0n;
        }

        const price = prices.get(assetId) as bigint;

        return (
            (getAvailableToBorrowWithEMode(
                assetsConfig,
                assetsData,
                principals,
                prices,
                poolConfig.masterConstants,
                poolConfig,
            ).availableToBorrow *
                10n ** assetConfig.decimals) /
            price
        );
    }

    return withdrawAmountMax;
}

export function getAvailableToBorrow(
    assetsConfig: ExtendedAssetsConfig,
    assetsData: ExtendedAssetsData,
    principals: Dictionary<bigint, bigint>,
    prices: Dictionary<bigint, bigint>,
    masterConstants: MasterConstants,
): bigint {
    let borrowLimit = 0n;
    let borrowAmount = 0n;

    for (const assetID of principals.keys()) {
        const principal = principals.get(assetID) as bigint;

        if (principal == 0n) {
            continue;
        }

        if (!prices.has(assetID)) {
            return 0n;
        }

        const assetConfig = assetsConfig.get(assetID) as AssetConfig;
        const assetData = assetsData.get(assetID) as ExtendedAssetData;
        const price = prices.get(assetID) as bigint;

        if (principal < 0n) {
            borrowAmount += mulDiv(
                calculatePresentValue(assetData.bRate, -principal, masterConstants),
                price,
                10n ** assetConfig.decimals,
            );
        } else if (principal > 0n) {
            borrowLimit += mulDiv(
                mulDiv(
                    calculatePresentValue(assetData.sRate, principal, masterConstants),
                    price,
                    10n ** assetConfig.decimals,
                ),
                assetConfig.collateralFactor,
                masterConstants.ASSET_COEFFICIENT_SCALE,
            );
        }
    }

    return borrowLimit - borrowAmount;
}

/**
 * Calculates balance value for asset principal.
 * @param sRate asset supply rate
 * @param bRate asset borrow rate
 * @param principalValue asset principal value
 * @param masterConstants pool constants
 */
export function presentValue(
    sRate: bigint,
    bRate: bigint,
    principalValue: bigint,
    masterConstants: MasterConstants,
): UserBalance {
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

/**
 * Calculates health parameters of the specified user account based on its parameters
 * @param parameters
 */
export function calculateHealthParams(parameters: HealthParamsArgs) {
    const { principals, prices, assetsData, assetsConfig, poolConfig } = parameters;

    const { ASSET_LIQUIDATION_THRESHOLD_SCALE } = poolConfig.masterConstants;
    const activeHeCategory = determineHeCategory(assetsConfig, principals, poolConfig);

    let totalSupply = 0n;
    let totalDebt = 0n;
    let totalLimit = 0n;

    for (const asset of poolConfig.poolAssetsConfig) {
        if (!principals.has(asset.assetId)) continue;
        const assetPrincipal = principals.get(asset.assetId)!;

        if (!assetsConfig.has(asset.assetId)) throw `No config for ${asset.name}:${asset.assetId}`;
        const assetConfig = assetsConfig.get(asset.assetId)!;

        if (!assetsData.has(asset.assetId)) throw `No data for asset ${asset.name}:${asset.assetId}`;
        const assetData = assetsData.get(asset.assetId)!;

        if (!prices.has(asset.assetId)) throw `No price for asset ${asset.name}:${asset.assetId}`;
        const assetPrice = prices.get(asset.assetId)! as bigint;
        const assetScale = 10n ** assetConfig.decimals;

        const { sRate, bRate } = assetData;
        const assetBalance = presentValue(sRate, bRate, assetPrincipal, poolConfig.masterConstants);
        const assetWorth = (assetBalance.amount * assetPrice) / assetScale;
        if (assetBalance.type === BalanceType.supply) {
            const liquidationThreshold =
                activeHeCategory > 0 && assetConfig.heCategory === activeHeCategory
                    ? assetConfig.heLiquidationThreshold
                    : assetConfig.liquidationThreshold;

            totalSupply += assetWorth;
            totalLimit += (assetWorth * liquidationThreshold) / ASSET_LIQUIDATION_THRESHOLD_SCALE;
        } else if (assetBalance.type === BalanceType.borrow && assetConfig.dust < assetBalance.amount) {
            totalDebt += assetWorth;
        }
    }

    const _isLiquidable = totalLimit < totalDebt;

    // the `bad debt` condition depends on certain asset's liquidation bonus parameter
    // , so it is not a user constant, but depends on certain asset
    const _isBadDebt = (liquidationBonus: bigint): boolean => {
        return isBadDebt(totalSupply, totalDebt, liquidationBonus, poolConfig.masterConstants) as boolean;
    };

    return {
        totalDebt,
        totalLimit,
        totalSupply,
        activeHeCategory,
        isLiquidatable: _isLiquidable,
        isBadDebt: _isBadDebt,
    };
}

/**
 * Calculates liquidation data for greatest loan and collateral assets
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

    const activeHeCategory = determineHeCategory(assetsConfig, principals, poolConfig);

    const { ASSET_SRATE_SCALE, ASSET_BRATE_SCALE, COLLATERAL_WORTH_THRESHOLD } = poolConfig.masterConstants;

    for (const asset of poolConfig.poolAssetsConfig) {
        const principal = principals.get(asset.assetId)!;
        if (!principal) continue;
        const assetConfig = assetsConfig.get(asset.assetId)!;
        const assetData = assetsData.get(asset.assetId)!;
        const balance =
            principal > 0
                ? (principal * assetData.sRate) / ASSET_SRATE_SCALE
                : (principal * assetData.bRate) / ASSET_BRATE_SCALE;

        const assetWorth = (bigAbs(balance) * prices.get(asset.assetId)!) / 10n ** assetConfig.decimals;
        if (balance > 0) {
            const liquidationThreshold =
                activeHeCategory > 0 && assetConfig.heCategory === activeHeCategory
                    ? assetConfig.heLiquidationThreshold
                    : assetConfig.liquidationThreshold;

            totalLimit += (assetWorth * liquidationThreshold) / poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE;
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
            (bigIntMax(collateralValue / 3n, bigIntMin(collateralValue, COLLATERAL_WORTH_THRESHOLD)) *
                loanScale *
                poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE) /
                liquidationBonus /
                loanAssetPrice,
        );
        values.push((loanValue * loanScale) / loanAssetPrice);

        const liquidationAmount = (bigIntMin(...values) as bigint) - 5n;
        const collateralAssetPrice: bigint = prices.get(collateralAsset.assetId)!;
        const collateralDecimal = 10n ** collateralAssetConfig.decimals;
        let minCollateralAmount =
            (((liquidationAmount * loanAssetPrice * liquidationBonus) /
                poolConfig.masterConstants.ASSET_LIQUIDATION_BONUS_SCALE) *
                collateralDecimal) /
                collateralAssetPrice /
                loanScale -
            10n;
        minCollateralAmount = (minCollateralAmount * 97n) / 100n;
        if (minCollateralAmount > 0n) {
            return {
                greatestCollateralAsset: collateralAsset,
                greatestCollateralValue: collateralValue,
                greatestLoanAsset: loanAsset,
                greatestLoanValue: loanValue,
                totalDebt,
                totalLimit,
                liquidable: true,
                liquidationAmount: addReserve(
                    liquidationAmount,
                    loanAssetConfig.liquidationReserveFactor,
                    poolConfig.masterConstants.ASSET_RESERVE_FACTOR_SCALE,
                ),
                minCollateralAmount,
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
    const { principals, prices, assetsData, assetsConfig, poolConfig } = args;
    const assetId = args.asset.assetId;
    const changeType = args.balanceChangeType;
    const currentAmount = args.amount;

    const heCategoryByAssetId = new Map<bigint, number>();
    for (const heConfig of poolConfig.poolAssetsHEConfig) {
        for (const asset of heConfig.assets) {
            heCategoryByAssetId.set(asset.assetId, heConfig.heCategory);
        }
    }

    const projectedBalances = new Map<bigint, bigint>();

    for (const asset of poolConfig.poolAssetsConfig) {
        if (!principals.has(asset.assetId)) {
            continue;
        }

        const assetPrincipal = principals.get(asset.assetId)!;
        const assetConfig = assetsConfig.get(asset.assetId)!;
        const assetData = assetsData.get(asset.assetId)!;
        const balance = presentValue(assetData.sRate, assetData.bRate, assetPrincipal, poolConfig.masterConstants);

        if (balance.type === BalanceType.supply) {
            projectedBalances.set(asset.assetId, balance.amount);
        } else if (balance.type === BalanceType.borrow) {
            projectedBalances.set(asset.assetId, -balance.amount);
        }
    }

    if (currentAmount != null && currentAmount != 0n) {
        const currentSignedBalance = projectedBalances.get(assetId) ?? 0n;
        const actionAssetConfig = assetsConfig.get(assetId)!;
        let newSignedBalance = currentSignedBalance;

        if (changeType == BalanceChangeType.Borrow) {
            const borrowWithFee =
                currentAmount +
                mulDivC(
                    currentAmount,
                    actionAssetConfig.originationFee,
                    poolConfig.masterConstants.ASSET_ORIGINATION_FEE_SCALE,
                );
            newSignedBalance -= borrowWithFee;
        } else if (changeType == BalanceChangeType.Repay) {
            newSignedBalance += currentAmount;
        } else if (changeType == BalanceChangeType.Withdraw) {
            newSignedBalance -= currentAmount;
        } else if (changeType == BalanceChangeType.Supply) {
            newSignedBalance += currentAmount;
        }

        projectedBalances.set(assetId, newSignedBalance);
    }

    const getHeCategoryForAsset = (assetID: bigint, assetConfig: AssetConfig): number => {
        return heCategoryByAssetId.get(assetID) ?? assetConfig.heCategory;
    };

    let projectedActiveHeCategory = -1;
    for (const asset of poolConfig.poolAssetsConfig) {
        const signedBalance = projectedBalances.get(asset.assetId) ?? 0n;
        if (signedBalance >= 0n) {
            continue;
        }

        const assetConfig = assetsConfig.get(asset.assetId)!;
        const heCategory = getHeCategoryForAsset(asset.assetId, assetConfig);
        if (heCategory <= 0) {
            projectedActiveHeCategory = -1;
            break;
        }

        if (projectedActiveHeCategory === -1) {
            projectedActiveHeCategory = heCategory;
            continue;
        }

        if (projectedActiveHeCategory !== heCategory) {
            projectedActiveHeCategory = -1;
            break;
        }
    }

    const calculateProjectedHealthFactor = (heCategoryForCalculation: number): number => {
        let totalLimit = 0n;
        let totalBorrow = 0n;

        for (const asset of poolConfig.poolAssetsConfig) {
            const signedBalance = projectedBalances.get(asset.assetId) ?? 0n;
            if (signedBalance === 0n) {
                continue;
            }

            const assetConfig = assetsConfig.get(asset.assetId)!;
            const price = prices.get(asset.assetId)!;
            const assetWorth = (bigAbs(signedBalance) * price) / 10n ** assetConfig.decimals;

            if (signedBalance > 0n) {
                const heCategory = getHeCategoryForAsset(asset.assetId, assetConfig);
                const liquidationThreshold =
                    heCategoryForCalculation > 0 && heCategory === heCategoryForCalculation
                        ? assetConfig.heLiquidationThreshold
                        : assetConfig.liquidationThreshold;
                totalLimit +=
                    (assetWorth * liquidationThreshold) / poolConfig.masterConstants.ASSET_LIQUIDATION_THRESHOLD_SCALE;
                continue;
            }

            const borrowAmount = -signedBalance;
            if (borrowAmount > assetConfig.dust) {
                totalBorrow += assetWorth;
            }
        }

        if (totalLimit === 0n) {
            return 1;
        }

        return Math.min(Math.max(1 - Number(totalBorrow) / Number(totalLimit), 0), 1);
    };

    if (projectedActiveHeCategory > 0) {
        let standardBorrowLimit = 0n;
        let projectedTotalBorrow = 0n;
        for (const asset of poolConfig.poolAssetsConfig) {
            const signedBalance = projectedBalances.get(asset.assetId) ?? 0n;
            if (signedBalance === 0n) continue;
            const assetConfig = assetsConfig.get(asset.assetId)!;
            const price = prices.get(asset.assetId)!;
            const assetWorth = (bigAbs(signedBalance) * price) / 10n ** assetConfig.decimals;
            if (signedBalance > 0n) {
                standardBorrowLimit +=
                    (assetWorth * assetConfig.collateralFactor) /
                    poolConfig.masterConstants.ASSET_COEFFICIENT_SCALE;
            } else if (-signedBalance > assetConfig.dust) {
                projectedTotalBorrow += assetWorth;
            }
        }

        if (projectedTotalBorrow > standardBorrowLimit) {
            return calculateProjectedHealthFactor(projectedActiveHeCategory);
        }
    }
    return calculateProjectedHealthFactor(-1);
}

/**
 * Predicts how APY will change as a result of one of the actions Borrow, Supply, Withdraw or Repay.
 *
 * Used on the front-end.
 *
 * @returns Estimated APYs for Supply and Borrow
 */
export function predictAPY(args: PredictAPYArgs): AssetInterest & AssetApy {
    const assetConfig = args.assetConfig;
    const assetData = args.assetData;
    const masterConstants = args.masterConstants;

    let totalSupply = calculatePresentValue(assetData.sRate, assetData.totalSupply, masterConstants);
    let totalBorrow = calculatePresentValue(assetData.bRate, assetData.totalBorrow, masterConstants);

    const currentAmount = args.amount;
    const changeType = args.balanceChangeType;

    if (currentAmount != null && currentAmount != 0n) {
        if (changeType == BalanceChangeType.Borrow) {
            totalBorrow += currentAmount;
        } else if (changeType == BalanceChangeType.Repay) {
            totalBorrow -= currentAmount;
        } else if (changeType == BalanceChangeType.Withdraw) {
            totalSupply -= currentAmount;
        } else if (changeType == BalanceChangeType.Supply) {
            totalSupply += currentAmount;
        }
    }

    const interest = calculateInterestWithSupplyBorrow(totalSupply, totalBorrow, assetConfig, masterConstants);

    return {
        ...interest,
        supplyApy: (1 + (Number(interest.supplyInterest) / 1e12) * 24 * 3600) ** 365 - 1,
        borrowApy: (1 + (Number(interest.borrowInterest) / 1e12) * 24 * 3600) ** 365 - 1,
    };
}
