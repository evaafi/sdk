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
    BalanceType,
    HealthParamsArgs,
    LiquidationData,
    PredictHealthFactorArgs,
    UserBalance
} from '../types/User';
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

export const BigMath = { mulFactor, mulDiv, mulDivC, abs: bigAbs, min: bigIntMin, max: bigIntMax };

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
            now
        };
    }

    return {
        sRate: assetData.sRate,
        bRate: assetData.bRate,
        supplyInterest,
        borrowInterest,
        now
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
        ...{ supplyApy, borrowApy }
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
                utilization - assetConfig.targetUtilization
            );
    }

    supplyInterest = mulDiv(
        mulDiv(borrowInterest, utilization, masterConstants.FACTOR_SCALE),
        masterConstants.ASSET_RESERVE_FACTOR_SCALE - assetConfig.reserveFactor,
        masterConstants.ASSET_RESERVE_FACTOR_SCALE
    );

    return {
        supplyInterest,
        borrowInterest
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
    masterConstants: MasterConstants
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
                user_total_borrow += presentValue(assetData.sRate, assetData.bRate, principal, masterConstants).amount * price / 10n ** assetConfig.decimals;
            } else {
                user_total_supply += presentValue(assetData.sRate, assetData.bRate, principal, masterConstants).amount * price / 10n ** assetConfig.decimals;
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
    masterConstants: MasterConstants,
    assetId: bigint
): bigint {
    let withdrawAmountMax = 0n;

    const assetConfig = assetsConfig.get(assetId) as AssetConfig;
    const assetData = assetsData.get(assetId) as ExtendedAssetData;
    const oldPrincipal = principals.get(assetId) as bigint;

    if (oldPrincipal > assetConfig.dust) {
        const oldPresentValue = presentValue(assetData.sRate, assetData.bRate, oldPrincipal, masterConstants);
        if (checkNotInDebtAtAll(principals)) {
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
            } else if (price > 0) {
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

        if (principal < 0n) {
            borrowAmount += (calculatePresentValue(assetData.bRate, -principal, masterConstants) * price) / 10n ** assetConfig.decimals;
        } else if (principal > 0n) {
            borrowLimit +=
                mulDivC(
                    mulDivC(calculatePresentValue(assetData.sRate, principal, masterConstants), price, 10n ** assetConfig.decimals),
                    assetConfig.collateralFactor,
                    masterConstants.ASSET_COEFFICIENT_SCALE);
        }
    }

    return borrowLimit - borrowAmount;
}

/**
 * Calculates balance value for asset principal
 * @param sRate asset supply rate
 * @param bRate asset borrow rate
 * @param principalValue asset principal value
 * @param masterConstants pool constants
 */
export function presentValue(sRate: bigint, bRate: bigint, principalValue: bigint, masterConstants: MasterConstants): UserBalance {
    if (principalValue > 0) {
        return {
            amount: calculatePresentValue(sRate, principalValue, masterConstants),
            type: BalanceType.supply
        };
    } else if (principalValue < 0) {
        return {
            amount: calculatePresentValue(bRate, -principalValue, masterConstants),
            type: BalanceType.borrow
        };
    } else {
        return {
            amount: 0n,
            type: undefined
        };
    }
}

/**
 * Determines if the provided pair of assets forms a bad debt
 * @param totalSupply total supply worth amount
 * @param totalBorrow total borrow worth amount
 * @param liquidationBonus collateral liquidation bonus value
 * @param masterConstants pool constants
 */
export function isBadDebt(totalSupply: bigint, totalBorrow: bigint,
                          liquidationBonus: bigint, masterConstants: MasterConstants
) {
    return totalSupply * masterConstants.ASSET_LIQUIDATION_BONUS_SCALE < totalBorrow * liquidationBonus;
}

/**
 * Calculates user account health parameters
 * @param args
 */
export function calculateHealthParams(args: HealthParamsArgs) {
    const {
        principals, prices,
        assetsData, assetsConfig,
        poolConfig
    } = args;

    const { ASSET_LIQUIDATION_THRESHOLD_SCALE } = poolConfig.masterConstants;

    let totalSupply = 0n;
    let totalDebt = 0n;
    let totalLimit = 0n;

    for (const asset of poolConfig.poolAssetsConfig) {
        if (!principals.has(asset.assetId)) continue;
        const assetPrincipal = principals.get(asset.assetId)!;

        if (!assetsConfig.has(asset.assetId)) throw (`No config for ${asset.name}:${asset.assetId}`);
        const assetConfig = assetsConfig.get(asset.assetId)!;

        if (!assetsData.has(asset.assetId)) throw (`No data for asset ${asset.name}:${asset.assetId}`);
        const assetData = assetsData.get(asset.assetId)!;

        if (!prices.has(asset.assetId)) throw (`No price for asset ${asset.name}:${asset.assetId}`);
        const assetPrice = prices.get(asset.assetId)! as bigint;
        const assetScale = 10n ** assetConfig.decimals;

        const { sRate, bRate } = assetData;
        const assetBalance = presentValue(sRate, bRate, assetPrincipal, poolConfig.masterConstants);
        const assetWorth = assetBalance.amount * assetPrice / assetScale;
        if (assetBalance.type === BalanceType.supply) {
            totalSupply += assetWorth;
            totalLimit += assetWorth * assetConfig.liquidationThreshold / ASSET_LIQUIDATION_THRESHOLD_SCALE;
        } else if (assetBalance.type === BalanceType.borrow) {
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
        totalDebt, totalLimit, totalSupply,
        isLiquidable: _isLiquidable,
        isBadDebt: _isBadDebt
    };
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
    const { isLiquidable } = calculateHealthParams(args);
    return isLiquidable;
}

/**
 * Adds reserve to liquidation amount
 * @param amount raw liquidation amount
 * @param reserveFactor asset reserve factor
 * @param factorScale asset reserve factor scale
 * @returns liquidation amount with reserve
 */
export function addReserve(amount: bigint, reserveFactor: bigint, factorScale: bigint): bigint {
    return amount * factorScale / (factorScale - reserveFactor);
}

/**
 * Deducts reserve from liquidation amount
 * @param amount liquidation amount with reserve
 * @param reserveFactor asset reserve factor
 * @param reserveFactorScale asset reserve factor scale
 * @returns liquidation amount without reserve
 */
export function deductReserve(amount: bigint, reserveFactor: bigint, reserveFactorScale: bigint): bigint {
    return amount * (reserveFactorScale - reserveFactor) / reserveFactorScale;
}

type FailType = { ok: false };

type GetAssetDataResult = {
    config: AssetConfig,
    data: AssetData,
    price: bigint,
    principal: bigint,
    scale: bigint,
    liquidationReserveFactor: bigint,
    liquidationBonus: bigint,
    present: UserBalance,
    balance: bigint,
    dust: bigint,
    ok: true,
};

function getAssetData(assetId: bigint,
                      assetsConfigDict: ExtendedAssetsConfig,
                      assetsDataDict: ExtendedAssetsData,
                      pricesDict: Dictionary<bigint, bigint>,
                      principalsDict: Dictionary<bigint, bigint>,
                      masterConstants: MasterConstants
): GetAssetDataResult | FailType {
    if (!assetsConfigDict.has(assetId) ||
        !assetsDataDict.has(assetId) ||
        !pricesDict.has(assetId) ||
        !principalsDict.has(assetId)) {
        return { ok: false };
    }

    const config = assetsConfigDict.get(assetId)!;
    const data = assetsDataDict.get(assetId)!;
    const base = {
        ok: true,
        config, data,
        price: pricesDict.get(assetId)!,
        principal: principalsDict.get(assetId)!,
        scale: 10n ** config.decimals,
        liquidationReserveFactor: config.liquidationReserveFactor,
        liquidationBonus: config.liquidationBonus
    };

    const assetPresent = presentValue(data.sRate, data.bRate, base.principal, masterConstants);
    const dustPresent = presentValue(data.sRate, data.bRate, config.dust, masterConstants);

    return { ...base, present: assetPresent, balance: assetPresent.amount, dust: dustPresent.amount };
}

const toAssetAmount = (worth: bigint, scale: bigint, price: bigint): bigint => worth * scale / price;
const toAssetWorth = (amount: bigint, scale: bigint, price: bigint): bigint => amount * price / scale;

const addLiquidationBonus = (value: bigint, bonus: bigint, scale: bigint): bigint => value * bonus / scale;
const deductLiquidationBonus = (value: bigint, bonus: bigint, scale: bigint): bigint => value * scale / bonus;

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
    loanAsset: PoolAssetConfig,
    collateralAsset: PoolAssetConfig,
    supplyAmount: bigint,
    borrowAmount: bigint, // from calculate health params
    principalsDict: Dictionary<bigint, bigint>,
    pricesDict: Dictionary<bigint, bigint>,
    assetsDataDict: ExtendedAssetsData,
    assetsConfigDict: ExtendedAssetsConfig,
    masterConstants: MasterConstants
): {
    liquidationAmount: bigint, collateralAmount: bigint,
    calculateLoanByCollateral?: (amount: bigint) => bigint,
    calculateCollateralByLoan?: (amount: bigint) => bigint,
} {
    const loan = getAssetData(loanAsset.assetId,
        assetsConfigDict, assetsDataDict, pricesDict, principalsDict, masterConstants
    );
    const collateral = getAssetData(collateralAsset.assetId,
        assetsConfigDict, assetsDataDict, pricesDict, principalsDict, masterConstants
    );

    if (!loan.ok || !collateral.ok ||
        loan.present.type !== BalanceType.borrow ||
        collateral.present.type !== BalanceType.supply) {
        return { liquidationAmount: 0n, collateralAmount: 0n };
    }

    const liquidationBonusScale = masterConstants.ASSET_LIQUIDATION_BONUS_SCALE;
    const collateralThreshold = masterConstants.COLLATERAL_WORTH_THRESHOLD;
    const reserveFactorScale = masterConstants.ASSET_RESERVE_FACTOR_SCALE;
    const reserveFactor = loan.liquidationReserveFactor;
    const liquidationBonus = collateral.liquidationBonus;

    let allowedCollateralAmount = collateral.balance;
    const is_bad_debt = isBadDebt(supplyAmount, borrowAmount, liquidationBonus, masterConstants);
    if (!is_bad_debt) {
        BigMath.max(collateral.balance / 2n, BigMath.min(collateral.balance, collateralThreshold));
    }

    const baseLiquidationWorth = BigMath.min(
        toAssetWorth(loan.balance, loan.scale, loan.price),
        deductLiquidationBonus(
            toAssetWorth(allowedCollateralAmount, collateral.scale, collateral.price),
            liquidationBonus,
            liquidationBonusScale
        )
    );

    // calculate collateral amount
    let collateralAmount = addLiquidationBonus(baseLiquidationWorth, liquidationBonus, liquidationBonusScale);
    collateralAmount = toAssetAmount(collateralAmount, collateral.scale, collateral.price);

    // calculate loan amount
    let liquidationAmount = toAssetAmount(baseLiquidationWorth, loan.scale, loan.price);
    liquidationAmount = addReserve(liquidationAmount, reserveFactor, reserveFactorScale);

    const calculateLoanByCollateral = (amount: bigint): bigint => {
        if (amount < 0n) throw (`Invalid collateral amount`);
        if (amount > collateralAmount) return collateralAmount;

        let value = toAssetWorth(amount, collateral.scale, collateral.price);
        value = deductLiquidationBonus(value, liquidationBonus, liquidationBonusScale);
        value = addReserve(value, reserveFactor, reserveFactorScale);
        const loanAmount = toAssetAmount(value, loan.scale, loan.price);
        return loanAmount + loan.dust;
    };

    const calculateCollateralByLoan = (amount: bigint) => {
        if (amount < 0n) throw (`Invalid loan amount: ${amount}`);
        if (amount > liquidationAmount) return collateralAmount;

        let value = toAssetWorth(amount, loan.scale, loan.price);
        value = deductReserve(value, reserveFactor, reserveFactorScale);
        value = addLiquidationBonus(value, liquidationBonus, liquidationBonusScale);
        const maxCollateralAmount = toAssetAmount(value, loan.scale, loan.price);
        const res = maxCollateralAmount - collateral.dust;
        return ((res > 0n) ? res : 0n);
    };

    return {
        liquidationAmount: liquidationAmount + loan.dust,
        collateralAmount,
        calculateLoanByCollateral,
        calculateCollateralByLoan
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
    poolConfig: PoolConfig
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
        if (minCollateralAmount > 0n) {
            return {
                greatestCollateralAsset: collateralAsset,
                greatestCollateralValue: collateralValue,
                greatestLoanAsset: loanAsset,
                greatestLoanValue: loanValue,
                totalDebt,
                totalLimit,
                liquidable: true,
                liquidationAmount: addReserve(liquidationAmount, loanAssetConfig.liquidationReserveFactor, poolConfig.masterConstants.ASSET_RESERVE_FACTOR_SCALE),
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
        liquidable: false
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

    const decimals = Number(assetConfig.decimals);

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
