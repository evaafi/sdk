import { Cell, Dictionary } from '@ton/core';
import * as sdk from '../../src';
import {
    AssetConfig,
    ExtendedAssetData,
    FakeCollector,
    MASTER_CONSTANTS,
    NULL_ADDRESS,
    PoolConfig,
    UserLiteData,
    TON_MAINNET,
    TSTON_MAINNET,
} from '../../src';

function createAssetConfig(overrides: Partial<AssetConfig> = {}): AssetConfig {
    return {
        jwAddress: 0n,
        decimals: 0n,
        collateralFactor: 7000n,
        liquidationThreshold: 7500n,
        liquidationBonus: 10500n,
        baseBorrowRate: 0n,
        borrowRateSlopeLow: 0n,
        borrowRateSlopeHigh: 0n,
        supplyRateSlopeLow: 0n,
        supplyRateSlopeHigh: 0n,
        targetUtilization: 0n,
        originationFee: 0n,
        dust: 0n,
        maxTotalSupply: 0n,
        reserveFactor: 0n,
        liquidationReserveFactor: 0n,
        minPrincipalForRewards: 0n,
        baseTrackingSupplySpeed: 0n,
        baseTrackingBorrowSpeed: 0n,
        borrowCap: 0n,
        heCategory: 1,
        heCollateralFactor: 9000n,
        heLiquidationThreshold: 9500n,
        ...overrides,
    };
}

function createExtendedAssetData(): ExtendedAssetData {
    return {
        sRate: MASTER_CONSTANTS.FACTOR_SCALE,
        bRate: MASTER_CONSTANTS.FACTOR_SCALE,
        totalSupply: 1000n,
        totalBorrow: 0n,
        lastAccrual: 0n,
        balance: 1000n,
        trackingSupplyIndex: 0n,
        trackingBorrowIndex: 0n,
        awaitedSupply: 0n,
        supplyInterest: 0n,
        borrowInterest: 0n,
        supplyApy: 0,
        borrowApy: 0,
    };
}

function createHeFixture() {
    const assetsConfig = Dictionary.empty<bigint, AssetConfig>()
        .set(TON_MAINNET.assetId, createAssetConfig())
        .set(TSTON_MAINNET.assetId, createAssetConfig());

    const assetsData = Dictionary.empty<bigint, ExtendedAssetData>()
        .set(TON_MAINNET.assetId, createExtendedAssetData())
        .set(TSTON_MAINNET.assetId, createExtendedAssetData());

    const principals = Dictionary.empty<bigint, bigint>().set(TON_MAINNET.assetId, 100n).set(TSTON_MAINNET.assetId, -80n);
    const prices = Dictionary.empty<bigint, bigint>().set(TON_MAINNET.assetId, 1n).set(TSTON_MAINNET.assetId, 1n);
    const poolConfig: PoolConfig = {
        masterAddress: NULL_ADDRESS,
        masterVersion: 0,
        masterConstants: MASTER_CONSTANTS,
        poolAssetsConfig: [TON_MAINNET, TSTON_MAINNET],
        poolAssetsHEConfig: [{ title: 'ton', assets: [TON_MAINNET, TSTON_MAINNET], heCategory: 1 }],
        lendingCode: Cell.EMPTY,
        collector: new FakeCollector(Dictionary.empty<bigint, bigint>()),
    };
    const userLiteData: UserLiteData = {
        type: 'active',
        codeVersion: 0,
        masterAddress: NULL_ADDRESS,
        ownerAddress: NULL_ADDRESS,
        principals,
        realPrincipals: principals,
        state: 0,
        balances: Dictionary.empty(),
        trackingSupplyIndex: 0n,
        trackingBorrowIndex: 0n,
        dutchAuctionStart: 0,
        backupCell: Cell.EMPTY,
        rewards: Dictionary.empty(),
        backupCell1: null,
        backupCell2: null,
        fullyParsed: false,
    };

    return { assetsConfig, assetsData, principals, prices, poolConfig, userLiteData };
}

describe('HeMode API surface', () => {
    test('package root exposes only canonical HeMode function names', () => {
        expect(sdk.getAvailableToBorrowWithHeMode).toBeDefined();
        expect(sdk.calculateRepayToExitHeMode).toBeDefined();

        const sdkExports = sdk as Record<string, unknown>;
        expect(sdkExports.getAvailableToBorrowWithEMode).toBeUndefined();
        expect(sdkExports.calculateRepayToExitEMode).toBeUndefined();
    });

    test('parseUserData returns renamed HeMode fields and omits legacy Emode fields', () => {
        const { assetsConfig, assetsData, principals, prices, poolConfig, userLiteData } = createHeFixture();

        const borrowHeadroom = sdk.getAvailableToBorrowWithHeMode(
            assetsConfig,
            assetsData,
            principals,
            prices,
            MASTER_CONSTANTS,
            poolConfig,
        );
        expect(borrowHeadroom).toEqual({ availableToBorrow: 10n, heCategory: 1 });

        const parsed = sdk.parseUserData(userLiteData, assetsData, assetsConfig, prices, poolConfig);
        expect(parsed.type).toBe('active');
        if (parsed.type !== 'active') {
            throw new Error('Expected active user data');
        }

        expect(parsed.availableToBorrowWithHeMode).toEqual(10n);
        expect(parsed.borrowLimitsWithHeMode.get(TON_MAINNET.assetId)).toEqual(10n);
        expect(parsed.borrowLimitsWithHeMode.get(TSTON_MAINNET.assetId)).toEqual(10n);

        const parsedRecord = parsed as Record<string, unknown>;
        expect(parsedRecord.availableToBorrowWithEmode).toBeUndefined();
        expect(parsedRecord.borrowLimitsWithEmode).toBeUndefined();
    });
});
