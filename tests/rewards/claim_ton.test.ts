import { TonClient, WalletContractV4 } from '@ton/ton';
import { configDotenv } from 'dotenv';
import { MAINNET_MASTER_TON_REWARD_CONFIG } from '../../src/constants/pools';

import { KeyPair, mnemonicToWalletKey } from '@ton/crypto';
import { EVAA_REWARDS_USER_CODE_MAINNET } from '../../src/constants/general';
import { RewardUser } from '../../src/rewards/RewardUser';

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

    const userWallet = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: userKeyPair.publicKey,
        }),
    );

    console.log(userWallet.address);

    const userConfig = {
        asset: MAINNET_MASTER_TON_REWARD_CONFIG.asset,
        publicKey: MAINNET_MASTER_TON_REWARD_CONFIG.publicKey,
        rewardMasterAddress: MAINNET_MASTER_TON_REWARD_CONFIG.adminAddress,
        rewardUserCode: EVAA_REWARDS_USER_CODE_MAINNET,
        userAddress: userWallet.address,
    };

    const userRewardOpened = client.open(RewardUser.createFromConfig(userConfig));
    const claimAmount = BigInt(1);

    console.log(RewardUser.createFromConfig(userConfig).address);
    const claimBody = userRewardOpened.claimMessageToCell(claimAmount);
    const signedCell = userRewardOpened.signClaimMessage(claimBody, adminKeyPair.secretKey);

    // await userRewardOpened.sendDeploy(userWallet.sender(userKeyPair.secretKey));

    await userRewardOpened.sendClaim(
        userWallet.sender(userKeyPair.secretKey),
        signedCell,
        // claimBody.toBoc().toString('base64'),
    );
});
