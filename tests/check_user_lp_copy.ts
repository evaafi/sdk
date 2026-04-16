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

    const userAddress = Address.parse('UQAq-I1fRZcegpp2bDALewjsXfdYRnYqE7KMA8DIi98EQAvX');
    const user = TON_CLIENT.open(evaa.openUserContract(userAddress));

    await user.getSync(evaa.data.assetsData, evaa.data.assetsConfig, prices.dict);

    const data = user.data;
    if (!data || data.type !== 'active') {
        console.log('No active user data, type:', data?.type);
        return;
    }

    console.log('predictedHeCategory:', data.predictedHeCategory);
    console.log('activeHeCategory:', data.activeHeCategory);
    console.log('availableToBorrowWithEmode:', data.availableToBorrowWithEmode?.toString());

    console.log('\nAll borrow limits:');
    for (const asset of MAINNET_CLASSIC_HE_POOL_CONFIG.poolAssetsConfig) {
        const emode = data.borrowLimitsWithEmode?.get(asset.assetId);
        const normal = data.borrowLimits?.get(asset.assetId);
        console.log(`  ${asset.name}: normal=${normal?.toString()} emode=${emode?.toString()}`);
    }

    console.log('\nPrincipals:');
    for (const [id, p] of data.realPrincipals) {
        const name = MAINNET_CLASSIC_HE_POOL_CONFIG.poolAssetsConfig.find((a) => a.assetId === id)?.name ?? id.toString().slice(0, 8);
        console.log(`  ${name}: ${p.toString()}`);
    }
}

main().catch(console.error);
