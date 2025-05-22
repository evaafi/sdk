import {BalanceChangeType, createAssetConfig, Evaa, EVAA_MASTER_MAINNET, getPrices, JUSDC_TESTNET, MAINNET_LP_POOL_CONFIG, MAINNET_POOL_CONFIG, MAINNET_TEST_ETHENA_POOL_CONFIG, TESTNET_POOL_CONFIG, TONUSDT_DEDUST_MAINNET, USDT_MAINNET, UserDataActive} from '../src';
import {Address, beginCell, Dictionary, TonClient} from '@ton/ton';
import dotenv from 'dotenv';
import { predictHealthFactor } from '../src/api/math';
import { sha256Hash } from '../src/utils/sha256BigInt';
import { STTON_MAINNET } from '../src/constants/assets';

let client: TonClient;
beforeAll(async () => {
    dotenv.config();
    /*client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });*/
    client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY_MAINNET,
    });
});

test('Health factor check example', async () => {
    const evaa = client.open(new Evaa({poolConfig: MAINNET_POOL_CONFIG}));
    await evaa.getSync();
    console.log(evaa.data?.assetsConfig);
    const user = client.open(await evaa.openUserContract(Address.parseFriendly("UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM").address));
   // await user.getSyncLite(evaa.data!.assetsData, evaa.data!.assetsConfig);
    //console.log(user.liteData);
    const priceData = await evaa.getPrices();
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);
    console.log('userdata', (user.data as UserDataActive).principals);
    console.log('userdata', (user.data as UserDataActive).balances);
    console.log('userdata')
    /*
    console.log('priceData', priceData);
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);
    console.log('userdata', (user.data as UserDataActive).balances);
    //console.log(evaa.data!.assetsConfig.get(sha256Hash("TON")));
    //console.log(user.data);
    const userPrincipals = (user.data! as UserDataActive).principals;
    //console.log(evaa.data!.assetsConfig.get(sha256Hash("TON"))?.decimals);
    console.log('heath factor predict', predictHealthFactor({
        balanceChangeType: BalanceChangeType.Repay,
        amount: 4000n,
        asset: USDT_MAINNET,
        principals: userPrincipals,
        prices: priceData!.dict,
        assetsData: evaa.data!.assetsData,
        assetsConfig: evaa.data!.assetsConfig,
        poolConfig: MAINNET_POOL_CONFIG
    }));
    console.log(user.data);*/
});
