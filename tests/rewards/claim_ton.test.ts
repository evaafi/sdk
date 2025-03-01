import { TonClient } from '@ton/ton';
import dotenv from 'dotenv';

import { TESTNET_USER_REWARD_CONFIG } from '../../src/constants/pools';
import { EvaaUserRewards } from '../../src/rewards/EvaaUserRewards';

let client: TonClient;

beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TONCENTER_API_KEY,
    });
});

test('rewards claim ton', async () => {
    const userReward = client.open(new EvaaUserRewards(TESTNET_USER_REWARD_CONFIG));

    userReward.
});
