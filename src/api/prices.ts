import {PoolConfig} from '../types/Master';
import {MAINNET_POOL_CONFIG} from '../constants/pools';
import {FeedMapItem} from "../api/feeds";

import {Buffer} from "buffer";
import {HermesClient, HexString} from "@pythnetwork/hermes-client";
import {Cell} from "@ton/core";
import {beginCell} from "@ton/ton";
import {createCellChain} from "@pythnetwork/pyth-ton-js";
import { DefaultPriceSourcesConfig, PriceSourcesConfig } from '../prices';


export const DEFAULT_HERMES_ENDPOINT = 'https://hermes.pyth.network';

/**
 * Updates feeds data from specified endpoint
 * @param hermesEndpoint prices servide endpoint
 * @param feedIds list of pyth feed ids to fetch
 * @returns binary - buffer of feeds update, parsed - json feeds data
 */
export async function getPythFeedsUpdates(feedIds: HexString[], hermesEndpoint: string = DEFAULT_HERMES_ENDPOINT) {
    const hermesClient = new HermesClient(hermesEndpoint);
    const latestPriceUpdates = await hermesClient.getLatestPriceUpdates(feedIds, { encoding: 'hex' });

    const parsed = latestPriceUpdates.parsed;
    const binary = Buffer.from(latestPriceUpdates.binary.data[0], 'hex');

    return { binary, parsed };
}

export function composeFeedsCell(feeds: HexString[]): Cell {
    if (feeds.length === 0) {
        return beginCell().storeUint(0, 8).endCell();
    }

    const reversedTail = feeds.slice(1).reverse();
    const packedTail = reversedTail.reduce(
        (prev: Cell | null, curr) => {
            const builder = beginCell().storeUint(BigInt(curr), 256);
            if (prev !== null) builder.storeRef(prev);
            return builder.endCell();
        }, null
    );
    const firstFeed = feeds[0];
    const builder = beginCell().storeUint(feeds.length, 8).storeUint(BigInt(firstFeed), 256);
    if (packedTail !== null) {
        builder.storeRef(packedTail!);
    }

    return builder.endCell();
}

export function packPythUpdatesData(pythUpdates: Buffer|Cell): Cell {
    return  pythUpdates instanceof Cell ? pythUpdates : createCellChain(pythUpdates);
}

// todo: implement

// need to have a mapping evaa => [pyth_original, pyth_referred] and combine all feeds to a resulting list
/**
 * takes evaa ids and returns required set of pyth feeds
 * @param evaaIds list of evaa ids
 * @returns list of pyth feeds required to get specified evaa ids
 */
export function createRequiredFeedsList(evaaIds: bigint[], feedsMap: Map<bigint, FeedMapItem>): HexString[] {
    const requiredFeeds = new Set<bigint>();
    const queue = [...evaaIds];

    const evaaToPythMap = new Map<bigint, bigint>();
    for (const [pythId, feedInfo] of feedsMap.entries()) {
        evaaToPythMap.set(feedInfo.evaaId, pythId);
    }

    while (queue.length > 0) {
        const evaaId = queue.shift();
        if (!evaaId) continue;

        const pythId = evaaToPythMap.get(evaaId);
        if (pythId && !requiredFeeds.has(pythId)) {
            requiredFeeds.add(pythId);
            const feedInfo = feedsMap.get(pythId);
            if (feedInfo && feedInfo.referredPythFeed !== 0n) {
                const referredPythId = feedInfo.referredPythFeed;
                if(!requiredFeeds.has(referredPythId)) {
                    requiredFeeds.add(referredPythId);
                }
            }
        }
    }

    return Array.from(requiredFeeds).map(id => "0x" + id.toString(16));
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

    const priceCollector = new PricesCollector(poolConfig, sources);
    const prices = await priceCollector.getPrices();

    return { dict: prices.dict, dataCell: prices.dataCell };
}
*/ 