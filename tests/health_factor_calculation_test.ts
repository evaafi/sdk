import {BalanceChangeType, createAssetConfig, Evaa, EVAA_MASTER_MAINNET, getPrices, UserDataActive} from '../src';
import {Address, beginCell, Dictionary, TonClient} from '@ton/ton';
import dotenv from 'dotenv';
import { predictHealthFactor } from '../src/api/math';
import { sha256Hash } from '../src/utils/sha256BigInt';

let client: TonClient;
beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
});

test('Health factor check example', async () => {
    const evaa = client.open(new Evaa());
    await evaa.getSync();
    const user = client.open(await evaa.openUserContract(Address.parseFriendly("UQC6oolqwFm36Tis31Pk5i6EGsblu8PyhVLB-IX1xU9pryd5").address));

    const priceData = await getPrices();

    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);
    console.log(evaa.data!.assetsConfig.get(sha256Hash("TON")));
    const userPrincipals = (user.data! as UserDataActive).principals;
    console.log(evaa.data!.assetsConfig.get(sha256Hash("TON"))?.decimals);
    console.log('heath factor predict', predictHealthFactor({
        balanceChangeType: BalanceChangeType.Borrow,
        amount: 1000000n,
        tokenSymbol: 'USDT',
        balances: userPrincipals,
        prices: priceData!.dict,
        assetsData: evaa.data!.assetsData,
        assetsConfig: evaa.data!.assetsConfig
    }));
    console.log(user.data);
});
