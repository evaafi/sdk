import { HexString } from '@pythnetwork/hermes-client';
import { createCellChain } from '@pythnetwork/pyth-ton-js';
import { Cell } from '@ton/core';
import { beginCell } from '@ton/ton';
import { Buffer } from 'buffer';

export function composeFeedsCell(feeds: HexString[]): Cell {
    if (feeds.length === 0) {
        return beginCell().storeUint(0, 8).endCell();
    }

    const reversedTail = feeds.slice(1).reverse();
    const packedTail = reversedTail.reduce((prev: Cell | null, curr) => {
        const builder = beginCell().storeUint(BigInt(curr), 256);
        if (prev !== null) builder.storeRef(prev);
        return builder.endCell();
    }, null);
    const firstFeed = feeds[0];
    const builder = beginCell().storeUint(feeds.length, 8).storeUint(BigInt(firstFeed), 256);
    if (packedTail !== null) {
        builder.storeRef(packedTail!);
    }

    return builder.endCell();
}

export function packPythUpdatesData(pythUpdates: Buffer | Cell): Cell {
    return pythUpdates instanceof Cell ? pythUpdates : createCellChain(pythUpdates);
}

/*
old code:
export async function getPrices(endpoints: string[] = ["api.stardust-mainnet.iotaledger.net"], poolConfig: PoolConfig = MAINNET_POOL_CONFIG): Promise<PriceData> {
    if (endpoints.length == 0) {
        throw new Error("Empty endpoint list");
    }

    const sources: PriceSourcesConfig = {
        icpEndpoints: DefaultPriceSourcesConfig.icpEndpoints,
        backendEndpoints: DefaultPriceSourcesConfig.backendEndpoints,
    }

    const priceCollector = new ClassicCollector(poolConfig, sources);
    const prices = await priceCollector.getPrices();

    return { dict: prices.dict, dataCell: prices.dataCell };
}
*/
