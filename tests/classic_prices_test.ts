import { Dictionary, toNano } from '@ton/core';
import { ClassicCollector, ORACLES_LP, TON_MAINNET, USDE_MAINNET, USDT_MAINNET } from '../src';

async function main() {
    const poolAssets = [TON_MAINNET, USDT_MAINNET, USDE_MAINNET];

    const cc = new ClassicCollector({
        poolAssetsConfig: poolAssets,
        minimalOracles: 3,
        evaaOracles: ORACLES_LP,
    });

    const userPrincipals = Dictionary.empty<bigint, bigint>()
        .set(TON_MAINNET.assetId, toNano(1))
        .set(USDE_MAINNET.assetId, toNano(1) * -1n);

    const twapPrices = await cc.getPricesForWithdraw(userPrincipals, USDT_MAINNET);

    for (const twapPriceKey of twapPrices.dict.keys()) {
        const twapPrice = twapPrices.dict.get(twapPriceKey);
        console.log(`[TWAP]: ${twapPriceKey} ${twapPrice}`);
    }

    const spotPrices = await cc.getPricesForLiquidate(userPrincipals);

    for (const spotPriceKey of spotPrices.dict.keys()) {
        const spotPrice = spotPrices.dict.get(spotPriceKey);
        console.log(`[SPOT]: ${spotPriceKey} ${spotPrice}`);
    }
}

main();
