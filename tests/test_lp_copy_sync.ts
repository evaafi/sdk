import { TonClient } from '@ton/ton';
import { EvaaMasterClassic, MAINNET_LP_POOL_COPY_CONFIG } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY,
});

async function main() {
    const evaa = TON_CLIENT.open(
        new EvaaMasterClassic({
            poolConfig: MAINNET_LP_POOL_COPY_CONFIG,
        }),
    );

    try {
        await evaa.getSync();
        console.log('getSync OK');
        console.log('assetsConfig keys:', evaa.data?.assetsConfig?.keys().map(k => k.toString()));
        console.log('assetsData keys:', evaa.data?.assetsData?.keys().map(k => k.toString()));

        // Check pool asset names
        for (const asset of MAINNET_LP_POOL_COPY_CONFIG.poolAssetsConfig) {
            const config = evaa.data?.assetsConfig?.get(asset.assetId);
            const data = evaa.data?.assetsData?.get(asset.assetId);
            console.log(`\n${asset.name}:`);
            console.log(`  config: ${config ? 'OK' : 'MISSING'}`);
            console.log(`  data: ${data ? 'OK' : 'MISSING'}`);
            if (config) {
                console.log(`  heCategory: ${config.heCategory}`);
            }
        }
    } catch (e) {
        console.error('getSync FAILED:', e);
    }
}

main();
