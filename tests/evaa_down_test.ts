import 'dotenv/config';

import { Address, beginCell, toNano } from '@ton/core';
import { keyPairFromSecretKey } from '@ton/crypto';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { EVAA_EVAA_REWARDS_MASTER_MAINNET, EVAA_MAINNET, getUserJettonWallet, RewardMaster} from '../src';
import { JettonWallet } from '../src/rewards/JettonWallet';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function jettonBalanceUp() {

    const rewardMaster = TON_CLIENT.open(new RewardMaster(EVAA_EVAA_REWARDS_MASTER_MAINNET));

     const WALLET_KEY_PAIR = keyPairFromSecretKey(Buffer.from(process.env.EVAA_ADMIN_REWARDS_SECRET!, 'hex'));

    console.log(WALLET_KEY_PAIR.publicKey.toString('hex'));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV5R1.create({
            workChain: 0,
            publicKey: WALLET_KEY_PAIR.publicKey,
        }),
    );

     await rewardMaster.sendAdminWithdraw(
        WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey),
        WALLET_CONTRACT.address,
        0.1
     );

}

jettonBalanceUp();
