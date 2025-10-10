import 'dotenv/config';

import { TonClient } from '@ton/ton';
import { EVAA_EVAA_REWARDS_MASTER_MAINNET, RewardMaster } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function parseMasterReward() {
    const rewardMaster = TON_CLIENT.open(new RewardMaster(EVAA_EVAA_REWARDS_MASTER_MAINNET));

    const data = await rewardMaster.getData();
    console.log(data);
}

parseMasterReward();
