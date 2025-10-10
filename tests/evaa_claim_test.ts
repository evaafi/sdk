import 'dotenv/config';

import { Address, toNano } from '@ton/core';
import { KeyPair, mnemonicToWalletKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { EvaaUserRewards, MAINNET_MASTER_EVAA_REWARD_CONFIG } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function claim() {
    const rewarduser = TON_CLIENT.open(
        new EvaaUserRewards(
            Address.parse('UQCcb-wwS8T8YiMAAZfm9M-ONUMPtfmXHTFfh85_AyHBx83u'),
            MAINNET_MASTER_EVAA_REWARD_CONFIG,
        ).openContract(),
    );

    const adminKeyPair: KeyPair = await mnemonicToWalletKey(process.env.EVAA_ADMIN_REWARDS_MNEMONIC!.split(' '));

    console.log('admin publickey', adminKeyPair.publicKey.toString('hex'));

    const claimAmount = toNano('0.1'); // EVAA jetton decimals like TON

    const claimBody = rewarduser.claimMessageToCell(BigInt(claimAmount));
    const signedClaimMessage = rewarduser.signClaimMessage(claimBody, adminKeyPair.secretKey);

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

    await rewarduser.sendClaim(WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey), signedClaimMessage);
}

claim();
