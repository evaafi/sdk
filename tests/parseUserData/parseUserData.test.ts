import { Evaa, EvaaUser, MAINNET_POOL_CONFIG, Prices, PricesCollector, RawPriceData, UserDataActive, verifyPricesSign, verifyRawPriceDataSign } from "../../src";
import { Address, Dictionary, OpenedContract, TonClient } from "@ton/ton";

import dotenv from 'dotenv';

describe('parseUserData test', () => {
    dotenv.config();
    let clientMainNet;
    let evaaMainNet: OpenedContract<Evaa>;
    let pricesCollector: PricesCollector;
    const addr: Address = Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address;
    beforeAll(async () => {
        clientMainNet = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: process.env.RPC_API_KEY_MAINNET,
            
        });
        evaaMainNet = clientMainNet.open(new Evaa({poolConfig: MAINNET_POOL_CONFIG}));
        pricesCollector = new PricesCollector(MAINNET_POOL_CONFIG);
        await evaaMainNet.getSync();
    });

    test('test user with prices', async () => {
        expect.assertions(1);
        
        let user: OpenedContract<EvaaUser> = clientMainNet.open(await evaaMainNet.openUserContract(addr));
         
        await user.getSync(evaaMainNet.data?.assetsData!, evaaMainNet.data?.assetsConfig!, (await pricesCollector.getPrices()).dict);

        const data = (user.data as UserDataActive);

        expect(data.fullyParsed).toEqual(true);
    });


    test('test user without price', async () => {
        expect.assertions(2);
        
        let user: OpenedContract<EvaaUser> = clientMainNet.open(await evaaMainNet.openUserContract(addr));
         
        await user.getSync(evaaMainNet.data?.assetsData!, evaaMainNet.data?.assetsConfig!, (await pricesCollector.getPrices()).dict);

        let data = (user.data as UserDataActive);

        let assetIdToErase = 0n;
        for (const [assetId, pricnipal] of data.principals) {
            if (pricnipal != 0n) {
                assetIdToErase = assetId;
                break;
            }
        }

        // console.log('assetIdToErase', assetIdToErase);

        const dict: Dictionary<bigint, bigint> = (await pricesCollector.getPrices()).dict;
        const pricesCopy = Dictionary.empty<bigint, bigint>();
        expect(dict.delete(assetIdToErase)).toEqual(true);
        await user.getSync(evaaMainNet.data?.assetsData!, evaaMainNet.data?.assetsConfig!, pricesCopy);
        data = (user.data as UserDataActive);

        expect(data.fullyParsed).toEqual(false);
    });

    test('test user without unnecessary price', async () => {
        expect.assertions(2);
        
        let user: OpenedContract<EvaaUser> = clientMainNet.open(await evaaMainNet.openUserContract(addr));
         
        await user.getSync(evaaMainNet.data?.assetsData!, evaaMainNet.data?.assetsConfig!, (await pricesCollector.getPrices()).dict);

        let data = (user.data as UserDataActive);

        let assetIdToErase = 0n;
        for (const [assetId, pricnipal] of data.realPrincipals) {
            if (pricnipal == 0n) {
                assetIdToErase = assetId;
                break;
            }
        }

        // console.log('assetIdToErase', assetIdToErase);

        const dict: Dictionary<bigint, bigint> = (await pricesCollector.getPrices()).dict;
        const pricesCopy = Dictionary.empty<bigint, bigint>();
        expect(dict.delete(assetIdToErase)).toEqual(true);
        await user.getSync(evaaMainNet.data?.assetsData!, evaaMainNet.data?.assetsConfig!, pricesCopy);
        data = (user.data as UserDataActive);

        expect(data.fullyParsed).toEqual(false);
    });
});