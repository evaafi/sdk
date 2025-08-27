import { ASSET_ID } from '../constants/assets';
import { PoolAssetConfig } from '../types/Master';

export function isTonAsset(asset: PoolAssetConfig) {
    return asset.name === 'TON';
}

export function isTonAssetId(assetId: bigint) {
    return assetId === ASSET_ID.TON;
}

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchConfig {
    retries: number;
    timeout: number;
}

export const DefaultFetchConfig: FetchConfig = {
    retries: 3,
    timeout: 1000,
};

export async function proxyFetchRetries<T>(fetch: Promise<T>, config: FetchConfig = DefaultFetchConfig) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= config.retries; attempt++) {
        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), config.timeout);
            });

            return await Promise.race([fetch, timeoutPromise]);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < config.retries) {
                // Exponential backoff: wait 1s, 2s, 4s, etc.
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(`Failed to fetch after ${config.retries + 1} attempts. Last error: ${JSON.stringify(lastError)}`);
}

export function isValidSubaccountId(subaccountId: number) {
    return (subaccountId << 16) >> 16 === subaccountId && subaccountId !== -0x8000;
}
