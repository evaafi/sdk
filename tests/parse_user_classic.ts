import { mnemonicToWalletKey } from '@ton/crypto';
import { Address, TonClient, WalletContractV4 } from '@ton/ton';
import { EvaaMasterClassic, EvaaUser, TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED } from '../src';

import 'dotenv/config';

const TON_CLIENT = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_TESTNET,
});

async function parseUser() {
    const EVAA_TESTNET = TON_CLIENT.open(
        new EvaaMasterClassic({ poolConfig: TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED }),
    );

    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.TESTNET_WALLET_MNEMONIC!.split(' '));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: WALLET_KEY_PAIR.publicKey,
        }),
    );

    await EVAA_TESTNET.getSync();

    const EVAA_USER_TESTNET = TON_CLIENT.open(
        EvaaUser.createFromAddress(
            Address.parse('0QBOq441r0EiLi1VXlH_-ez9piPIe_4Kyzk5zNk04jTgfsRI'),
            TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED,
        ),
    );

    if (!EVAA_TESTNET.data?.assetsData || !EVAA_TESTNET.data?.assetsConfig) {
        throw new Error('Assets data or config is not available');
    }

    await EVAA_USER_TESTNET.getSyncLite(EVAA_TESTNET.data?.assetsData, EVAA_TESTNET.data?.assetsConfig);

    const userLiteData = EVAA_USER_TESTNET.liteData;
    console.log('userLiteData');
    console.dir(userLiteData);
}

parseUser();
