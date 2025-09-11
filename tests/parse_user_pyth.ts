import { mnemonicToWalletKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { EvaaMasterPyth, MAINNET_POOL_CONFIG } from '../src';

import 'dotenv/config';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function parseUser() {
    const EVAA_MAINNET = TON_CLIENT.open(new EvaaMasterPyth({ poolConfig: MAINNET_POOL_CONFIG }));

    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC!.split(' '));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: WALLET_KEY_PAIR.publicKey,
        }),
    );

    await EVAA_MAINNET.getSync();

    const EVAA_USER_MAINNET = TON_CLIENT.open(EVAA_MAINNET.openUserContract(WALLET_CONTRACT.address));

    if (!EVAA_MAINNET.data?.assetsData || !EVAA_MAINNET.data?.assetsConfig) {
        throw new Error('Assets data or config is not available');
    }

    await EVAA_USER_MAINNET.getSyncLite(EVAA_MAINNET.data?.assetsData, EVAA_MAINNET.data?.assetsConfig);

    const userLiteData = EVAA_USER_MAINNET.liteData;
    console.log('userLiteData');
    console.dir(userLiteData?.realPrincipals);
}

parseUser();
