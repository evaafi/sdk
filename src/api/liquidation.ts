import { Dictionary } from '@ton/core';
import {
    AssetConfig,
    AssetData,
    ExtendedAssetsConfig,
    ExtendedAssetsData,
    MasterConstants,
    PoolAssetConfig,
    PoolConfig
} from '../types/Master';
import { BigMath, calculateHealthParams, presentValue } from './math';
import { BalanceType, UserBalance } from '../types/User';

export function findAssetById(assetId: bigint, poolConfig: PoolConfig): PoolAssetConfig | undefined {
    return poolConfig.poolAssetsConfig.find(asset => asset.assetId === assetId);
}

export type AssetsValues = {
    loanAssets: Dictionary<bigint, bigint>,
    collateralAssets: Dictionary<bigint, bigint>
}

export type SelectedAssets = {
    selectedLoanId: bigint,
    selectedCollateralId: bigint,
    selectedLoanValue?: bigint,
    selectedCollateralValue?: bigint,
}

export function calculateAssetsValues(
    principalsDict: Dictionary<bigint, bigint>,
    pricesDict: Dictionary<bigint, bigint>,
    assetsConfigDict: ExtendedAssetsConfig,
    assetsDataDict: ExtendedAssetsData,
    poolConfig: PoolConfig
): AssetsValues {
    const loanAssets = Dictionary.empty<bigint, bigint>();
    const collateralAssets = Dictionary.empty<bigint, bigint>();

    for (const asset of poolConfig.poolAssetsConfig) {
        const assetId = asset.assetId;
        if (!principalsDict.has(assetId)) {
            continue;
        }
        const assetPrincipal: bigint = principalsDict.get(assetId)!;
        if (!pricesDict.has(assetId)) {
            console.warn(`No price for asset ${asset.name}`);
            continue;
        }
        const assetPrice = pricesDict.get(assetId)!;
        if (!assetsDataDict.has(assetId)) {
            console.warn(`Dynamics for assetId ${assetId} is not defined, skipping`);
            continue;
        }
        const assetData = assetsDataDict.get(assetId)!;

        if (!assetsConfigDict.has(assetId)) {
            console.warn(`Config for assetId ${assetId} is not defined, skipping`);
            continue;
        }
        const assetConfig = assetsConfigDict.get(assetId)!;
        const assetScale = 10n ** assetConfig.decimals;
        const { sRate, bRate } = assetData;
        const assetPresent = presentValue(sRate, bRate, assetPrincipal, poolConfig.masterConstants);
        const assetValue = assetPresent.amount * assetPrice / assetScale;
        if (assetPresent.type === BalanceType.borrow) {
            loanAssets.set(assetId, assetValue);
        } else {
            collateralAssets.set(assetId, assetValue);
        }
    }

    return { loanAssets, collateralAssets };
}

export function selectGreatestAssets(principalsDict: Dictionary<bigint, bigint>,
                                     pricesDict: Dictionary<bigint, bigint>,
                                     assetsConfigDict: ExtendedAssetsConfig,
                                     assetsDataDict: ExtendedAssetsData,
                                     poolConfig: PoolConfig): SelectedAssets {
    let maxLoanId = 0n;
    let maxLoanValue = 0n;
    let maxCollateralId = 0n;
    let maxCollateralValue = 0n;

    const assetsValues = calculateAssetsValues(principalsDict, pricesDict, assetsConfigDict, assetsDataDict, poolConfig);

    for (const [loanId, loanValue] of assetsValues.loanAssets) {
        if (loanValue > maxLoanValue) {
            maxLoanId = loanId;
            maxLoanValue = loanValue;
        }
    }

    for (const [collateralId, collateralValue] of assetsValues.collateralAssets) {
        if (collateralValue > maxCollateralValue) {
            maxCollateralValue = collateralValue;
            maxCollateralId = collateralId;
        }
    }

    return {
        selectedLoanId: maxLoanId,
        selectedLoanValue: maxLoanValue,
        selectedCollateralId: maxCollateralId,
        selectedCollateralValue: maxCollateralValue
    };
}

/**
 * This function shows how to calculate min collateral amount value.
 * when liquidator has not enough of loan asset to cover the full loan.
 * @param transferredAmount amount of loan asset liquidator want to transfer.
 * @param maxLiquidationAmount max liquidation amount value calculated.
 * @param maxCollateralReward max collateral reward amount calculated.
 * @returns minCollateralAmount value for safe liquidation.
 */
export function calculateMinCollateralByTransferredAmount(
    transferredAmount: bigint, maxLiquidationAmount: bigint, maxCollateralReward: bigint
) {
    if (maxLiquidationAmount === 0n) {
        return 0n;
    }
    return maxCollateralReward * transferredAmount / maxLiquidationAmount;
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
 * @returns maxLiquidationAmount max loan asset amount to transfer
 * @returns maxCollateralRewardAmount max collateral reward amount, which can be obtained
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
    maxLiquidationAmount: bigint, maxCollateralRewardAmount: bigint
} {
    const loanInfo = prepareAssetInfo(loanAsset.assetId,
        assetsConfigDict, assetsDataDict, pricesDict, principalsDict, masterConstants
    );
    const collateralInfo = prepareAssetInfo(collateralAsset.assetId,
        assetsConfigDict, assetsDataDict, pricesDict, principalsDict, masterConstants
    );

    if (!loanInfo.ok || !collateralInfo.ok ||
        loanInfo.present.type !== BalanceType.borrow ||
        collateralInfo.present.type !== BalanceType.supply) {
        return { maxLiquidationAmount: 0n, maxCollateralRewardAmount: 0n };
    }

    const liquidationBonusScale = masterConstants.ASSET_LIQUIDATION_BONUS_SCALE;
    const collateralThreshold = masterConstants.COLLATERAL_WORTH_THRESHOLD; // basically 100$ worth (100*10^9)
    const reserveFactorScale = masterConstants.ASSET_RESERVE_FACTOR_SCALE;
    const reserveFactor = loanInfo.liquidationReserveFactor;
    const liquidationBonus = collateralInfo.liquidationBonus;

    let allowedCollateralValue = toAssetWorth(collateralInfo.balance, collateralInfo.scale, collateralInfo.price);

    const _isBadDebt = isBadDebt(supplyAmount, borrowAmount, liquidationBonus, masterConstants);
    if (!_isBadDebt) {
        allowedCollateralValue = BigMath.min(allowedCollateralValue, BigMath.max(allowedCollateralValue / 3n, collateralThreshold));
    }

    const loanValue = toAssetWorth(loanInfo.balance, loanInfo.scale, loanInfo.price);
    const baseLiquidationValue = BigMath.min(
        loanValue,
        deductLiquidationBonus(allowedCollateralValue, liquidationBonus, liquidationBonusScale)
    );

    // calculate collateral amount
    let collateralAmount = addLiquidationBonus(baseLiquidationValue, liquidationBonus, liquidationBonusScale);
    collateralAmount = toAssetAmount(collateralAmount, collateralInfo.scale, collateralInfo.price);

    // calculate loan amount
    let liquidationAmount = addReserve(baseLiquidationValue, reserveFactor, reserveFactorScale);
    liquidationAmount = toAssetAmount(liquidationAmount, loanInfo.scale, loanInfo.price);

    return {
        maxLiquidationAmount: liquidationAmount,
        maxCollateralRewardAmount: collateralAmount
    };
}

/**
 * Check if the user is subject to liquidation
 * @param args
 */
export function isLiquidatable(args: {
    assetsData: ExtendedAssetsData, assetsConfig: ExtendedAssetsConfig,
    principals: Dictionary<bigint, bigint>, prices: Dictionary<bigint, bigint>,
    poolConfig: PoolConfig
}): boolean {
    const { isLiquidatable: res } = calculateHealthParams(args);
    return res;
}

/**
 * Determines if the provided pair of assets forms a bad debt.
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

/**
 * Converts worth value to specified asset amount
 * @param worth worth value (decimals = 9)
 * @param scale asset scale (10^asset_decimals)
 * @param price asset price
 */
export function toAssetAmount(worth: bigint, scale: bigint, price: bigint): bigint {
    return worth * scale / price;
}

/**
 * Converts calculates worth value of specified asset amount
 * @param amount worth value (decimals = 9)
 * @param scale asset scale (10^asset_decimals)
 * @param price asset price
 */
export function toAssetWorth(amount: bigint, scale: bigint, price: bigint): bigint {
    return amount * price / scale;
}

/**
 * Adds liquidation bonus to reward value.
 * @param value reward asset value
 * @param bonus liquidation bonus factor
 * @param scale liquidation bonus scale
 */
export function addLiquidationBonus(value: bigint, bonus: bigint, scale: bigint): bigint {
    return value * bonus / scale;
}

/**
 * Deducts liquidation bonus from reward value.
 * @param value reward asset value
 * @param bonus liquidation bonus factor
 * @param scale liquidation bonus scale
 */
export function deductLiquidationBonus(value: bigint, bonus: bigint, scale: bigint): bigint {
    return value * scale / bonus;
}

export type SuccessType = { ok: true };
export type FailType = { ok: false };

export type PreparedAssetInfo = {
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
};

export type PreparedAssetInfoResult = (PreparedAssetInfo & SuccessType) | FailType;

/**
 * Prepares extended asset info
 * @param assetId
 * @param assetsConfigDict
 * @param assetsDataDict
 * @param pricesDict
 * @param principalsDict
 * @param masterConstants
 */
export function prepareAssetInfo(assetId: bigint,
                                 assetsConfigDict: ExtendedAssetsConfig,
                                 assetsDataDict: ExtendedAssetsData,
                                 pricesDict: Dictionary<bigint, bigint>,
                                 principalsDict: Dictionary<bigint, bigint>,
                                 masterConstants: MasterConstants
): PreparedAssetInfoResult {
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
