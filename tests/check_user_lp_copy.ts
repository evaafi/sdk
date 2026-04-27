import { Address, TonClient } from '@ton/ton';
import { EvaaMasterClassic, FakeCollector, MAINNET_CLASSIC_HE_POOL_CONFIG } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY,
});

async function main() {
    const evaa = TON_CLIENT.open(new EvaaMasterClassic({ poolConfig: MAINNET_CLASSIC_HE_POOL_CONFIG }));
    await evaa.getSync();

    if (!evaa.data?.assetsData || !evaa.data?.assetsConfig) {
        throw new Error('No assets data');
    }

    const collector = MAINNET_CLASSIC_HE_POOL_CONFIG.collector as FakeCollector;
    const prices = await collector.getPrices();

    const userAddress = Address.parse('UQB56dkNORVgBOyLEjxuydFkeQiaA1fW2kW7iULwm30iN2bc');
    const user = TON_CLIENT.open(evaa.openUserContract(userAddress));

    await user.getSync(evaa.data.assetsData, evaa.data.assetsConfig, prices.dict);

    const data = user.data;
    if (!data || data.type !== 'active') {
        console.log('No active user data, type:', data?.type);
        return;
    }

    const tston = MAINNET_CLASSIC_HE_POOL_CONFIG.poolAssetsConfig.find((a) => a.name === 'tsTON')!;
    const tstonOnChainConfig = evaa.data.assetsConfig.get(tston.assetId) as any;

    console.log('=== useEModeAvailableForAsset debug (tsTON borrow, mainnet HE pool) ===');
    console.log('pool:', 'MAINNET_CLASSIC_HE_POOL_CONFIG');
    console.log('asset.tokenSymbol:', tston.name);
    console.log('asset.heCategory (on-chain):', tstonOnChainConfig?.heCategory);
    console.log('userData.activeHeCategory:', data.activeHeCategory);
    console.log('userData.predictedHeCategory:', data.predictedHeCategory);
    console.log('eModeGroups (poolAssetsHEConfig):');
    for (const g of MAINNET_CLASSIC_HE_POOL_CONFIG.poolAssetsHEConfig) {
        console.log(`  heCategory=${g.heCategory} title=${g.title} assets=[${g.assets.map((a) => a.name).join(', ')}]`);
    }
}

main().catch(console.error);
