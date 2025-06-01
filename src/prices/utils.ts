import { beginCell, Cell, Dictionary, Slice } from "@ton/core";
import {PriceData, RawPriceData, TTL_ORACLE_DATA_SEC } from "..";


export function verifyPricesTimestamp() {
    return function(priceData: RawPriceData): boolean {
        const timestamp = Date.now() / 1000;
        const pricesTime = priceData.timestamp;

        //console.debug('timestamp - pricesTime, pricesTime', timestamp - pricesTime, pricesTime);
        return timestamp - pricesTime < TTL_ORACLE_DATA_SEC;
    }
}


export function getMedianPrice(pricesData: PriceData[], asset: bigint): bigint | null {
    try {
        const usingPrices = pricesData.filter(x => x.dict.has(asset));
        const sorted = usingPrices.map(x => x.dict.get(asset)!).sort((a, b) => Number(a) - Number(b));
        
        if (sorted.length == 0) {
            return null;
        }

        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2n;
        } else {
            return sorted[mid];
        }
    }
    catch {
        return null;
    }
}

export function packAssetsData(assetsData: {assetId: bigint, medianPrice: bigint}[]): Cell {
    if (assetsData.length == 0) {
        throw new Error("No assets data to pack");
    }
    return assetsData.reduceRight(
        (acc: Cell | null, {assetId, medianPrice}) => beginCell()
                                                          .storeUint(assetId, 256)
                                                          .storeCoins(medianPrice)
                                                          .storeMaybeRef(acc)
                                                        .endCell(), 
        null
    )!;
}