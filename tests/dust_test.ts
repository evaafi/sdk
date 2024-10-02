import {BalanceChangeType, createAssetConfig, Evaa, EVAA_MASTER_MAINNET, getPrices, MAINNET_LP_POOL_CONFIG, MAINNET_POOL_CONFIG, TESTNET_POOL_CONFIG, UserDataActive} from '../src';
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

test('Manual dust check', async () => {
    const evaa = client.open(new Evaa({poolConfig: TESTNET_POOL_CONFIG}));
    await evaa.getSync();
    const user = client.open(await evaa.openUserContract(Address.parseFriendly("0QAq-I1fRZcegpp2bDALewjsXfdYRnYqE7KMA8DIi98EQLBd").address));

    const priceData = await evaa.getPrices();
    //console.log('priceData', priceData);
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);
    
    if (user.data?.type != 'active') {
        console.log('User is inactive');
        return;
    }
    console.log('User principals')
    for (const asset of TESTNET_POOL_CONFIG.poolAssetsConfig) {
        if (!user.data.principals.has(asset.assetId)) {
            continue;
        }
        console.log('Asset: ', ' dust ', evaa.data?.assetsConfig.get(asset.assetId)?.dust, ' principal ', user.data.principals.get(asset.assetId),
            ' Withdrawal limits ', user.data.withdrawalLimits.get(asset.assetId), '  balances ', user.data.balances);
    }
});
