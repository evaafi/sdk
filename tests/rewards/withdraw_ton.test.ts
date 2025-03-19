import { Address, TonClient, WalletContractV4 } from '@ton/ton';
import { configDotenv } from 'dotenv';

import { KeyPair, mnemonicToWalletKey, sha256 } from '@ton/crypto';
import { EVAA_REWARDS_MASTER_CODE_TESTNET, EVAA_REWARDS_USER_CODE_TESTNET } from '../../src/constants/general';
import { RewardMaster } from '../../src/rewards/RewardMaster';

let client: TonClient;

beforeAll(async () => {
    configDotenv();
    client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TONCENTER_API_KEY,
    });
});

test('rewards claim ton', async () => {
    const adminKeyPair: KeyPair = await mnemonicToWalletKey(process.env.ADMIN_MNEMONIC!.split(' '));

    const adminWallet = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: adminKeyPair.publicKey,
        }),
    );

    const rewardAdmin = client.open(
        RewardMaster.createFromConfig(
            {
                adminAddress: adminWallet.address,
                availableReward: 0,
                rewardUserCode: EVAA_REWARDS_USER_CODE_TESTNET,
                evaaMasterAddress: new Address(0, Buffer.alloc(32, 0)),
                rewardTokenJettonWalletAddress: null, // must be empty address(=null) at first so do not change it!!!
                assetId: await sha256('TON'),
                publicKey: adminKeyPair.publicKey,
            },
            EVAA_REWARDS_MASTER_CODE_TESTNET,
        ),
    );
    await rewardAdmin.sendAdminWithdraw(adminWallet.sender(adminKeyPair.secretKey), adminWallet.address, 1);
});
