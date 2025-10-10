import 'dotenv/config';

import { Address, beginCell, toNano } from '@ton/core';
import { keyPairFromSecretKey } from '@ton/crypto';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { EVAA_EVAA_REWARDS_MASTER_MAINNET, EVAA_MAINNET, getUserJettonWallet } from '../src';
import { JettonWallet } from '../src/rewards/JettonWallet';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function jettonBalanceUp() {
    const jettonWallet = JettonWallet.createFromAddress(
        getUserJettonWallet(
            Address.parseFriendly('UQA5RgJbR5CkBiyHawL9yrFRZT4HLl3UD8G3v_eKeZpyuWQo').address,
            EVAA_MAINNET,
        ),
    );
    const WALLET_KEY_PAIR = keyPairFromSecretKey(Buffer.from(process.env.EVAA_ADMIN_REWARDS_SECRET!, 'hex'));

    console.log(WALLET_KEY_PAIR.publicKey);

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV5R1.create({
            workChain: 0,
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

    const openedjettonWallet = TON_CLIENT.open(jettonWallet);

    const jettonBalanceUp = toNano('0.5'); // EVAA 9 decimals like TON

    await openedjettonWallet.sendTransfer(
        WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey),
        toNano('0.1'),
        toNano('0.05'),
        EVAA_EVAA_REWARDS_MASTER_MAINNET,
        jettonBalanceUp,
        beginCell().endCell(),
    );
}

jettonBalanceUp();
