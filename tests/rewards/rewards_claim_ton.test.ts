import { Address, Cell } from '@ton/core';
import { KeyPair, mnemonicToWalletKey, sha256 } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import dotenv from 'dotenv';
import { EVAA_REWARDS_MASTER_CODE_TESTNET, EVAA_REWARDS_USER_CODE_TESTNET } from '../../src/constants/general';
import { EvaaOnchainRewards } from '../../src/rewards/EvaaOnchainRewards';
import { RewardMaster, RewardMasterConfig } from '../../src/rewards/RewardMaster';
import { RewardUser } from '../../src/rewards/RewardUser';

let client: TonClient;

beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TONCENTER_API_KEY,
    });
});

test('rewards claim test', async () => {
    // Setup admin wallet
    const mnemonicAdmin: KeyPair = await mnemonicToWalletKey(
        process.env
            .ADMIN_MNEMONIC! // joined with space
            .split(' '),
    );
    const adminWallet = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: mnemonicAdmin.publicKey,
        }),
    );
    const adminSender = adminWallet.sender(mnemonicAdmin.secretKey);

    // Setup user wallet
    const mnemonicUser: KeyPair = await mnemonicToWalletKey(
        process.env
            .USER_MNEMONIC! // joined with space
            .split(' '),
    );
    const userWallet = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: mnemonicUser.publicKey,
        }),
    );
    const userSender = userWallet.sender(mnemonicUser.secretKey);

    // Get contract codes
    const rewardMasterCode: Cell = EVAA_REWARDS_MASTER_CODE_TESTNET;
    const rewardUserCode: Cell = EVAA_REWARDS_USER_CODE_TESTNET;

    // Configure and deploy EvaaRewards
    const assetString = 'TON';
    const assetId: Buffer = await sha256(assetString);

    const masterConfig: RewardMasterConfig = {
        adminAddress: adminWallet.address,
        availableReward: 0,
        rewardUserCode,
        evaaMasterAddress: new Address(0, Buffer.alloc(32, 0)),
        rewardTokenJettonWalletAddress: null,
        assetId: assetId,
        publicKey: mnemonicAdmin.publicKey,
    };

    // Deploy RewardMaster contract
    const rewardMaster = client.open(RewardMaster.createFromConfig(masterConfig, rewardMasterCode));
    const initialMasterData = await rewardMaster.getData();
    expect(initialMasterData).toBeDefined();

    // Prepare user's RewardUser wrapper
    const userReward = client.open(
        RewardUser.createFromConfig(
            {
                userAddress: userWallet.address,
                baseTrackingAccrued: 0,
                rewardMasterAddress: rewardMaster.address,
                assetId: assetId,
                publicKey: mnemonicAdmin.publicKey,
            },
            rewardUserCode,
        ),
    );

    // Create rewards API helper instance
    const rewardsAPI = new EvaaOnchainRewards({
        rewardUser: userReward,
        userSender: userSender,
    });

    // Test reward claiming
    const availableRewards = 3;
    const claimAmount: bigint = BigInt(availableRewards);
    const signedClaimMessage = userReward.signClaimMessage(assetId, claimAmount, mnemonicAdmin.secretKey);

    const claimResult = await rewardsAPI.claimRewards(signedClaimMessage, false);
    expect(claimResult).toBeTruthy();

    // Verify updated data
    const updatedUserData = await userReward.getData();
    expect(updatedUserData).toBeDefined();

    const updatedMasterData = await rewardMaster.getData();
    expect(updatedMasterData).toBeDefined();
});
