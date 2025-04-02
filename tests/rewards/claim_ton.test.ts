import { TonClient, WalletContractV4 } from '@ton/ton';
import { configDotenv } from 'dotenv';
import { MAINNET_MASTER_TON_REWARD_CONFIG } from '../../src/constants/pools';

import { KeyPair, mnemonicToWalletKey } from '@ton/crypto';
import { EvaaUserRewards } from '../../src/rewards/EvaaRewards';

let client: TonClient;

beforeAll(async () => {
    configDotenv();
    client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TONCENTER_API_KEY,
    });
});

test('rewards claim ton', async () => {
    const userKeyPair: KeyPair = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC!.split(' '));
    const adminKeyPair: KeyPair = await mnemonicToWalletKey(process.env.ADMIN_MNEMONIC!.split(' '));

    console.log('admin publickey', adminKeyPair.publicKey.toString('hex'));

    const userWallet = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: userKeyPair.publicKey,
        }),
    );

    console.log(userWallet.address);

    const userRewardOpened = client.open(
        new EvaaUserRewards(userWallet.address, MAINNET_MASTER_TON_REWARD_CONFIG).openContract(),
    );
    console.log(userRewardOpened.address);

    const claimAmount = 1_100_000_000n;
    const claimBody = userRewardOpened.claimMessageToCell(claimAmount);
    const signedCell = userRewardOpened.signClaimMessage(claimBody, adminKeyPair.secretKey);

    await userRewardOpened.sendClaim(userWallet.sender(userKeyPair.secretKey), signedCell);
});
