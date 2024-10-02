import { Dictionary } from '@ton/core';
import { MAINNET_ASSETS_ID, ORACLE_NFTS } from '../constants';
import { PriceData, RawPriceData } from '../types/Common';
import { getMedianPrice, loadPrices, packAssetsData, packOraclesData, packPrices, parsePrices, verifyPrices } from '../utils/priceUtils';
import { MINIMAL_ORACLES_NUMBER } from '../config';

export async function getPrices(endpoints: String[] = ["api.stardust-mainnet.iotaledger.net", "iota.evaa.finance"], checkPrices = MAINNET_ASSETS_ID): Promise<PriceData> {
    if (endpoints.length == 0) {
        throw new Error("Empty endpoint list");
    }
    
    const prices = await Promise.all(ORACLE_NFTS.map(async x => await parsePrices(await loadPrices(x.address, endpoints), x.id)));

    let acceptedPrices: RawPriceData[] = prices.filter(verifyPrices(checkPrices));


    if (acceptedPrices.length < MINIMAL_ORACLES_NUMBER) {
        throw new Error("Prices are outdated");
    }

    if (acceptedPrices.length > MINIMAL_ORACLES_NUMBER && acceptedPrices.length % 2 == 0) {
        acceptedPrices = acceptedPrices.slice(0, acceptedPrices.length - 1);  // to reduce fees, MINIMAL_ORACLES_NUMBER is odd
    }

    if (acceptedPrices.length != MINIMAL_ORACLES_NUMBER) {
        const sortedByTimestamp = acceptedPrices.slice().sort((a, b) => b.timestamp - a.timestamp);
        const newerPrices = sortedByTimestamp.slice(0, MINIMAL_ORACLES_NUMBER);
        acceptedPrices = newerPrices.sort((a, b) => a.oracleId - b.oracleId);
    }


    const medianData = Object.values(checkPrices).map(assetId => ({ assetId: assetId, medianPrice: getMedianPrice(acceptedPrices, assetId)}));
    const packedMedianData = packAssetsData(medianData);

    const oraclesData = acceptedPrices.map(x => ({oracle: {id: x.oracleId, pubkey: x.pubkey}, data: {timestamp: x.timestamp, prices: x.dict}, signature: x.signature}));
    const packedOracleData = packOraclesData(oraclesData, Object.values(checkPrices));

    const dict = Dictionary.empty<bigint, bigint>();
    medianData.forEach(x => dict.set(x.assetId, x.medianPrice));

    return {
        dict: dict,
        dataCell: packPrices(packedMedianData, packedOracleData)
    };
}
