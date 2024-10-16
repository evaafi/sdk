import { Dictionary } from '@ton/core';
import { PriceData, RawPriceData } from '../types/Common';
import { getMedianPrice, loadPrices, packAssetsData, packOraclesData, packPrices, parsePrices, verifyPrices } from '../utils/priceUtils';
import { OracleNFT, PoolConfig } from '../types/Master';
import { MAINNET_POOL_CONFIG } from '../constants/pools';

export async function getPrices(endpoints: String[] = ["api.stardust-mainnet.iotaledger.net", "iota.evaa.finance"], poolConfig: PoolConfig = MAINNET_POOL_CONFIG): Promise<PriceData> {
    if (endpoints.length == 0) {
        throw new Error("Empty endpoint list");
    }
    
    const prices = await Promise.all(poolConfig.oracles.map(async x => await parsePrices(await loadPrices(x.address, endpoints), x.id)));
    
    let acceptedPrices: RawPriceData[] = prices.filter(verifyPrices(poolConfig.poolAssetsConfig));


    if (acceptedPrices.length < poolConfig.minimalOracles) {
        throw new Error("Prices are outdated");
    }

    if (acceptedPrices.length > poolConfig.minimalOracles && acceptedPrices.length % 2 == 0) {
        acceptedPrices = acceptedPrices.slice(0, acceptedPrices.length - 1);  // to reduce fees, MINIMAL_ORACLES_NUMBER is odd
    }

    if (acceptedPrices.length != poolConfig.minimalOracles) {
        const sortedByTimestamp = acceptedPrices.slice().sort((a, b) => b.timestamp - a.timestamp);
        const newerPrices = sortedByTimestamp.slice(0, poolConfig.minimalOracles);
        acceptedPrices = newerPrices.sort((a, b) => a.oracleId - b.oracleId);
    }


    const medianData = poolConfig.poolAssetsConfig.map(asset => ({ assetId: asset.assetId, medianPrice: getMedianPrice(acceptedPrices, asset.assetId)}));
    const packedMedianData = packAssetsData(medianData);

    const oraclesData = acceptedPrices.map(x => ({oracle: {id: x.oracleId, pubkey: x.pubkey}, data: {timestamp: x.timestamp, prices: x.dict}, signature: x.signature}));
    const packedOracleData = packOraclesData(oraclesData, poolConfig.poolAssetsConfig.map(x => x.assetId));

    const dict = Dictionary.empty<bigint, bigint>();
    medianData.forEach(x => dict.set(x.assetId, x.medianPrice));

    return {
        dict: dict,
        dataCell: packPrices(packedMedianData, packedOracleData)
    };
}
