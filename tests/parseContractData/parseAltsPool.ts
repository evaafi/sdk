import { calculatePresentValue, DOGS_MAINNET, Evaa, EvaaUser, MAINNET_ALTS_POOL_CONFIG, MAINNET_POOL_CONFIG, presentValue, Prices, PricesCollector, RawPriceData, UserDataActive, verifyPricesSign, verifyRawPriceDataSign } from "../../src";
import { Address, beginCell, Builder, Dictionary, OpenedContract, TonClient } from "@ton/ton";

import dotenv from 'dotenv';

describe('parseAltsData test', () => {
    dotenv.config();
    let clientMainNet: TonClient;
    let evaaMainNet: OpenedContract<Evaa>;
    let pricesCollector: PricesCollector;
    const addr: Address = Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address;
    beforeAll(async () => {
        clientMainNet = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: process.env.RPC_API_KEY_MAINNET,
            
        });
        evaaMainNet = clientMainNet.open(new Evaa({poolConfig: MAINNET_ALTS_POOL_CONFIG}));
        pricesCollector = new PricesCollector(MAINNET_ALTS_POOL_CONFIG);
        await evaaMainNet.getSync();
    });

    test('test DOGS', async () => {
        expect.assertions(1);
        
        const result = await clientMainNet.runMethod(MAINNET_ALTS_POOL_CONFIG.masterAddress, 'getAssetTotals', [{ type: "int", value: DOGS_MAINNET.assetId }])
        const assetData = evaaMainNet.data?.assetsData.get(DOGS_MAINNET.assetId)!;
        const totalSupplyPrincipal = assetData.totalSupply;

        const totalAmount = calculatePresentValue(assetData.sRate, totalSupplyPrincipal, MAINNET_ALTS_POOL_CONFIG.masterConstants);
        let diff = totalAmount - result.stack.readBigNumber();  // first is total suuply second is total borrow
        if (diff < 0) {
            diff = -diff;
        }
        expect(diff).toBeLessThan(2_000_000_000n);
    });
});