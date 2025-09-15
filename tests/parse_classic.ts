import { TonClient } from '@ton/ton';
import { EvaaMasterClassic, TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_TESTNET,
});

async function parseClassicMaster() {
    const evaaClassic = TON_CLIENT.open(
        new EvaaMasterClassic({
            poolConfig: TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED,
        }),
    );

    await evaaClassic.getSync();

    console.log('assetsConfig');
    console.dir(evaaClassic.data?.assetsConfig);

    console.log('assetsData');
    console.dir(evaaClassic.data?.assetsData);
}

// async function parsePythMaster() {
//     const evaaPyth = TON_CLIENT.open(
//         new EvaaMasterPyth({
//             poolConfig: TESTNET_PYTH_POOL_CONFIG_TOB_AUDITED,
//         }),
//     );

//     await evaaPyth.getSync();

//     console.log('assetsConfig');
//     console.dir(evaaPyth.data?.assetsConfig);

//     console.log('assetsData');
//     console.dir(evaaPyth.data?.assetsData);
// }




parseClassicMaster();
