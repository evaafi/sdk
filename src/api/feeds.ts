import { HexString } from '@pythnetwork/hermes-client';
import { Dictionary } from '@ton/ton';
import { Buffer } from 'buffer';

export const FEED_ID = {
    TON: '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
    USDT: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    stTON: '0x9145e059026a4d5a46f3b96408f7e572e33b3257b9c2dbe8dba551c772762002',
    tsTON: '0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25',
    USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    USDe: '0x6ec879b1e9963de5ee97e9c8710b742d6228252a5e2ca12d4ae81d7fe5ee8c5d',
    tsUSDe: '0xcbe184846426619a60f51056d26efecb0537ad3a73b1e965fe695d06a257cb19',
};

export function bigintToBuffer(value: bigint, size: number): Buffer {
    if (value < 0n) {
        throw new Error('Only non-negative bigint is supported');
    }
    // it's questionable whether it stores in LE or BE
    // and what option will TVM use, now by default it's BE
    const hex = value.toString(16);
    const padded = hex.padStart(size * 2, '0');
    return Buffer.from(padded, 'hex');
}

export const packConnectedFeeds = (evaa_id: bigint, feedId: HexString) => {
    return Buffer.concat([bigintToBuffer(evaa_id, 32), bigintToBuffer(BigInt(feedId), 32)]);
};

export const unpackConnectedFeeds = (buffer: Buffer): FeedMapItem => {
    return {
        assetId: BigInt(`0x${buffer.toString('hex', 0, 32)}`),
        feedId: `0x${buffer.toString('hex', 32)}`,
    };
};

export type FeedMapItem = {
    assetId: bigint;
    feedId: HexString;
};

export function parseFeedsMapDict(dict: Dictionary<bigint, Buffer>) {
    const parsedData = new Map<HexString, FeedMapItem>();
    for (const key of dict.keys()) {
        const buffer = dict.get(key)!;

        const assetId = BigInt(`0x${buffer.toString('hex', 0, 32)}`);
        const feedId = `0x${buffer.toString('hex', 32)}`;

        parsedData.set(`0x${key.toString(16)}`, { assetId, feedId });
    }

    return parsedData;
}
