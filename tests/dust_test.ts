import {BalanceChangeType, createAssetConfig, Evaa, EVAA_MASTER_MAINNET, getPrices, MAINNET_LP_POOL_CONFIG, MAINNET_POOL_CONFIG, PricesCollector, TESTNET_POOL_CONFIG, USDT_MAINNET, UserDataActive} from '../src';
import {Address, beginCell, Dictionary, TonClient} from '@ton/ton';
import dotenv from 'dotenv';
import { predictHealthFactor } from '../src/api/math';
import { sha256Hash } from '../src/utils/sha256BigInt';

let client: TonClient;
beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY_MAINNET,
    });
});

test('Manual dust check', async () => {
    const evaa = client.open(new Evaa({poolConfig: MAINNET_POOL_CONFIG}));
    await evaa.getSync();
    const user = client.open(await evaa.openUserContract(Address.parseFriendly("UQD0x5tVfMGTgUJpOvn6as58kKJEremAaXq8_rP3rA2bW3D9").address));

    const collector = new PricesCollector(MAINNET_POOL_CONFIG);
    //console.log('priceData', priceData);
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, (await collector.getPrices()).dict, true);
    
    if (user.data?.type != 'active') {
        console.log('User is inactive');
        return;
    }
    console.log('User principals');
    console.log('realPrincipals', user.data.realPrincipals);
    console.log('userPrincipal', user.data.principals);
    console.log('getPricesForWithdraw', (await collector.getPricesForWithdraw(user.data.realPrincipals, USDT_MAINNET)).dict);
    /*for (const asset of TESTNET_POOL_CONFIG.poolAssetsConfig) {
        if (!user.data.principals.has(asset.assetId)) {
            continue;
        }
        console.log('Asset: ', ' dust ', evaa.data?.assetsConfig.get(asset.assetId)?.dust, ' principal ', user.data.principals.get(asset.assetId),
            ' Withdrawal limits ', user.data.withdrawalLimits.get(asset.assetId), '  balances ', user.data.balances);
    }*/
});
