import { PoolAssetConfig } from "../types/Master";

export function isTonAsset(asset: PoolAssetConfig) {
    return asset.name === 'TON';
}

