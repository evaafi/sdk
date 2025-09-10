import { Dictionary } from '@ton/ton';
import { Buffer } from 'buffer';
import { ASSET_ID } from '../constants/assets';

export const PYTH_TON_PRICE_FEED_ID = '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026';
export const PYTH_USDT_PRICE_FEED_ID = '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b';
export const PYTH_STTON_PRICE_FEED_ID = '0x9145e059026a4d5a46f3b96408f7e572e33b3257b9c2dbe8dba551c772762002';
export const PYTH_TSTON_PRICE_FEED_ID = '0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25';
export const PYTH_USDC_PRICE_FEED_ID = '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';
export const PYTH_USDE_PRICE_FEED_ID = '0x6ec879b1e9963de5ee97e9c8710b742d6228252a5e2ca12d4ae81d7fe5ee8c5d';
export const PYTH_TSUSDE_PRICE_FEED_ID = '0xcbe184846426619a60f51056d26efecb0537ad3a73b1e965fe695d06a257cb19';

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

export const packConnectedFeeds = (evaa_id: bigint, reffered_id: bigint) => {
    return Buffer.concat([bigintToBuffer(evaa_id, 32), bigintToBuffer(reffered_id, 32)]);
};

export const EVAA_TON_PRICE_FEED_ID = ASSET_ID.TON;
export const EVAA_NOT_PRICE_FEED_ID = ASSET_ID.NOT;
export const EVAA_DOGS_PRICE_FEED_ID = ASSET_ID.DOGS;
export const EVAA_USDT_PRICE_FEED_ID = ASSET_ID.USDT;
export const EVAA_STTON_PRICE_FEED_ID = ASSET_ID.stTON;
export const EVAA_TSTON_PRICE_FEED_ID = ASSET_ID.tsTON;
export const EVAA_JUSDC_PRICE_FEED_ID = ASSET_ID.jUSDC;
export const EVAA_JUSDT_PRICE_FEED_ID = ASSET_ID.jUSDT;
export const EVAA_USDE_PRICE_FEED_ID = ASSET_ID.USDe;
export const EVAA_TSUSDE_PRICE_FEED_ID = ASSET_ID.tsUSDe;

export const MAIN_POOL_FEEDS_MAP: Dictionary<bigint, Buffer> = (() => {
    const map = Dictionary.empty<bigint, Buffer>();
    map.set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(EVAA_TON_PRICE_FEED_ID, 0n));
    map.set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(EVAA_USDT_PRICE_FEED_ID, 0n));
    map.set(
        BigInt(PYTH_STTON_PRICE_FEED_ID),
        packConnectedFeeds(EVAA_STTON_PRICE_FEED_ID, BigInt(PYTH_TON_PRICE_FEED_ID)),
    );
    map.set(
        BigInt(PYTH_TSTON_PRICE_FEED_ID),
        packConnectedFeeds(EVAA_TSTON_PRICE_FEED_ID, BigInt(PYTH_TON_PRICE_FEED_ID)),
    );
    map.set(BigInt(PYTH_USDC_PRICE_FEED_ID), packConnectedFeeds(EVAA_JUSDC_PRICE_FEED_ID, 0n));
    map.set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(EVAA_JUSDT_PRICE_FEED_ID, 0n));
    map.set(BigInt(PYTH_USDE_PRICE_FEED_ID), packConnectedFeeds(EVAA_USDE_PRICE_FEED_ID, 0n));
    map.set(BigInt(PYTH_TSUSDE_PRICE_FEED_ID), packConnectedFeeds(EVAA_TSUSDE_PRICE_FEED_ID, 0n));
    return map;
})();

export type FeedMapItem = {
    evaaId: bigint;
    referredPythFeed: bigint;
};

export function parseFeedsMapDict(dict: Dictionary<bigint, Buffer>) {
    const parsedData = new Map<bigint, FeedMapItem>();
    for (const key of dict.keys()) {
        const buffer = dict.get(key)!;

        const hex1 = '0x' + buffer.toString('hex', 0, 32);
        const hex2 = '0x' + buffer.toString('hex', 32);

        const evaaId = BigInt(hex1);
        const referredPythFeed = BigInt(hex2);

        parsedData.set(key, { evaaId, referredPythFeed });
    }

    return parsedData;
}

export const TESTNET_ALLOWED_REF_TOKENS: Dictionary<bigint, bigint> = (() => {
    const map = Dictionary.empty<bigint, bigint>();
    map.set(BigInt(EVAA_JUSDT_PRICE_FEED_ID), BigInt(EVAA_USDT_PRICE_FEED_ID));
    return map;
})();

export const TESTNET_FEEDS_MAP: Dictionary<bigint, Buffer> = (() => {
    const map = Dictionary.empty<bigint, Buffer>();
    map.set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(EVAA_TON_PRICE_FEED_ID, 0n));
    return map;
})();
