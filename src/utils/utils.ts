import { PoolAssetConfig } from "../types/Master";
import { ASSET_ID } from '../constants/assets';

export function isTonAsset(asset: PoolAssetConfig) {
    return asset.name === 'TON';
}

export function isTonAssetId(assetId: bigint) {
    return assetId === ASSET_ID.TON;
}

export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
