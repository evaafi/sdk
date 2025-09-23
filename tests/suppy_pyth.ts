import 'dotenv/config';

import { mnemonicToWalletKey } from '@ton/crypto';
import { Cell, TonClient, WalletContractV4 } from '@ton/ton';
import { EvaaMasterPyth, JUSDT_MAINNET, MAINNET_PYTH_V8_TOB_POOL_CONFIG } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function supplyJetton() {
    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC!.split(' '));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: WALLET_KEY_PAIR.publicKey,
        }),
    );

    console.log(WALLET_CONTRACT.address.toString());
    const balance = await WALLET_CONTRACT.getBalance();
    console.log(balance);
    if (balance == 0n) {
        console.log(`Wallet ${WALLET_CONTRACT.address} balance is 0, nothing to do`);
        return;
    }

    const EVAA_MAINNET = TON_CLIENT.open(
        new EvaaMasterPyth({ poolConfig: MAINNET_PYTH_V8_TOB_POOL_CONFIG, debug: true }),
    );
    const WALLET_SENDER = {
        address: WALLET_CONTRACT.address,
        send: WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey).send,
    };

    const amount = 1_000_000_000n;

    await EVAA_MAINNET.sendSupply(WALLET_SENDER, amount, {
        queryID: 0n,
        includeUserCode: true,
        amount: 1_000_000n,
        userAddress: WALLET_CONTRACT.address,
        asset: JUSDT_MAINNET,
        payload: Cell.EMPTY,
        customPayloadRecipient: WALLET_CONTRACT.address,
        subaccountId: 0,
        customPayloadSaturationFlag: false,
        returnRepayRemainingsFlag: false,
    });

    console.log('Supply sent');
}

supplyJetton();
