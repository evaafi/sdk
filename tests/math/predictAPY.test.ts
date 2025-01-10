import { AssetConfig, AssetData, BalanceChangeType, calculatePresentValue, Evaa, EvaaUser, ExtendedAssetData, MAINNET_POOL_CONFIG, MASTER_CONSTANTS, MasterConfig, MasterConstants, mulFactor, predictAPY, Prices, PricesCollector, RawPriceData, TON_MAINNET, UserDataActive, verifyPricesSign, verifyRawPriceDataSign } from "../../src";
import { Dictionary, OpenedContract, TonClient } from "@ton/ton";

import dotenv from 'dotenv';

describe('parseUserData test', () => {
    dotenv.config();
    let clientMainNet;
    let evaaMainNet: OpenedContract<Evaa>;
    let assetsData: Dictionary<bigint, ExtendedAssetData>;
    let assetsConfig: Dictionary<bigint, AssetConfig>;
    let masterConstants: MasterConstants;
    let tonData: ExtendedAssetData;
    let tonConfig: AssetConfig;
    let totalSupply: bigint;
    let totalBorrow: bigint;
    beforeAll(async () => {
        clientMainNet = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: process.env.RPC_API_KEY_MAINNET,
            
        });
        evaaMainNet = clientMainNet.open(new Evaa({poolConfig: MAINNET_POOL_CONFIG}));
        await evaaMainNet.getSync();
        assetsData = evaaMainNet.data?.assetsData!;
        assetsConfig = evaaMainNet.data?.assetsConfig!;
        masterConstants = evaaMainNet.poolConfig.masterConstants;

        tonData = assetsData.get(TON_MAINNET.assetId)!;
        tonConfig = assetsConfig.get(TON_MAINNET.assetId)!;
        totalSupply = calculatePresentValue(tonData.sRate, tonData.totalSupply, masterConstants);
        totalBorrow = calculatePresentValue(tonData.bRate, tonData.totalBorrow, masterConstants);
        
    });

    test('test full supplyborrow', () => {        
        const predicted = predictAPY({
            amount: totalSupply - totalBorrow,
            balanceChangeType: BalanceChangeType.Borrow,
            assetData: tonData,
            assetConfig: tonConfig,
            masterConstants: masterConstants
        });
        const borrowInterest =
            tonConfig.baseBorrowRate +
            mulFactor(masterConstants.FACTOR_SCALE, tonConfig.borrowRateSlopeLow, tonConfig.targetUtilization) +
            mulFactor(
                masterConstants.FACTOR_SCALE,
                tonConfig.borrowRateSlopeHigh,
                masterConstants.FACTOR_SCALE - tonConfig.targetUtilization
            );
        expect(predicted.borrowInterest).toEqual(borrowInterest);
    });

    test('test empty borrow', () => {        
        const predicted = predictAPY({
            amount: totalBorrow,
            balanceChangeType: BalanceChangeType.Repay,
            assetData: tonData,
            assetConfig: tonConfig,
            masterConstants: masterConstants
        });

        expect(predicted.borrowInterest).toEqual(tonConfig.baseBorrowRate);
    });

    test('test 0 value', () => {        
        const predicted = predictAPY({
            amount: 0n,
            balanceChangeType: BalanceChangeType.Repay,
            assetData: tonData,
            assetConfig: tonConfig,
            masterConstants: masterConstants
        });
        expect(predicted.borrowInterest).toEqual(tonData.borrowInterest);
    });
});