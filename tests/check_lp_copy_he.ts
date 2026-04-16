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

    await evaa.getSync();

    const assetsConfig = evaa.data?.assetsConfig;
    if (!assetsConfig) {
        console.log('No assets config found');
        return;
    }

    // Map asset IDs to names from pool config
    const assetNames = new Map<string, string>();
    for (const asset of MAINNET_LP_POOL_COPY_CONFIG.poolAssetsConfig) {
        assetNames.set(asset.assetId.toString(), asset.name);
    }

    for (const [assetId, config] of assetsConfig) {
        const name = assetNames.get(assetId.toString()) ?? 'UNKNOWN';
        console.log(`${name} (${assetId}):`);
        console.log(`  heCategory: ${config.heCategory}`);
        console.log(`  heCollateralFactor: ${config.heCollateralFactor}`);
        console.log(`  heLiquidationThreshold: ${config.heLiquidationThreshold}`);
        console.log();
    }
}

main().catch(console.error);
