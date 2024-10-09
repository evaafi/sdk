import {BalanceChangeType, createAssetConfig, Evaa, EVAA_MASTER_MAINNET, getPrices, MAINNET_POOL_CONFIG, TESTNET_POOL_CONFIG, UserDataActive} from '../src';
import {Address, beginCell, Dictionary, TonClient} from '@ton/ton';
import dotenv from 'dotenv';
import { predictHealthFactor } from '../src/api/math';
import { sha256Hash } from '../src/utils/sha256BigInt';

let client: TonClient;
beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
});

test('Health factor check example', async () => {
    const evaa = client.open(new Evaa({poolConfig: TESTNET_POOL_CONFIG}));
    await evaa.getSync();
    const user = client.open(await evaa.openUserContract(Address.parseFriendly("0QDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWCdG").address));

    const priceData = await evaa.getPrices();

    console.log('priceData', priceData);
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);
    console.log(evaa.data!.assetsConfig.get(sha256Hash("TON")));
    const userPrincipals = (user.data! as UserDataActive).principals;
    console.log(evaa.data!.assetsConfig.get(sha256Hash("TON"))?.decimals);
    console.log('heath factor predict', predictHealthFactor({
        balanceChangeType: BalanceChangeType.Borrow,
        amount: 1000000n,
        tokenSymbol: 'jUSDT',
        principals: userPrincipals,
        prices: priceData!.dict,
        assetsData: evaa.data!.assetsData,
        assetsConfig: evaa.data!.assetsConfig,
        poolConfig: MAINNET_POOL_CONFIG
    }));
    console.log(user.data);
});
