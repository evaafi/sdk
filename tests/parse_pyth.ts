import { TonClient } from '@ton/ton';
import { EvaaMasterPyth, MAINNET_PYTH_V8_TOB_POOL_CONFIG } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function parsePythMaster() {
    const evaaPyth = TON_CLIENT.open(
        new EvaaMasterPyth({
            poolConfig: MAINNET_PYTH_V8_TOB_POOL_CONFIG,
        }),
    );

    await evaaPyth.getSync();

    console.log('evaaPyth');
    for (const assetConfigKey of evaaPyth.data?.assetsConfig.keys() ?? []) {
        const assetConfig = evaaPyth.data?.assetsConfig.get(assetConfigKey);

        console.log(`${assetConfig?.jwAddress}: ${assetConfig?.borrowCap}`);
    }

    // console.log('assetsConfig');
    // console.dir(evaaPyth.data?.assetsConfig);

    // console.log('assetsData');
    // console.dir(evaaPyth.data?.assetsData);
}

parsePythMaster();
