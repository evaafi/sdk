import { beginCell, Cell, Dictionary, Slice } from "@ton/core";
import { BackendPriceSource, DefaultPriceSourcesConfig, IcpPriceSource, IotaPriceSource, MAINNET_POOL_CONFIG, OraclePricesData, PriceData, PriceSource, PriceSourcesConfig, RawPriceData, TTL_ORACLE_DATA_SEC } from "..";
import { Oracle, OracleNFT, PoolConfig } from "../types/Master";
import { convertToMerkleProof, generateMerkleProofDirect } from "../utils/merkleProof";
import { signVerify } from "@ton/crypto";

export function verifyPricesTimestamp() {
    return function(priceData: RawPriceData): boolean {
        const timestamp = Date.now() / 1000;
        const pricesTime = priceData.timestamp;

        //console.debug('timestamp - pricesTime, pricesTime', timestamp - pricesTime, pricesTime);
        return timestamp - pricesTime < TTL_ORACLE_DATA_SEC;
    }
}

export function verifyPricesSign(nfts: OracleNFT[]) {
    return function(priceData: RawPriceData): boolean {
        if (nfts.findIndex(x => x.pubkey.equals(priceData.pubkey)) == -1) {
            //console.debug('[verifyPricesSign] nft not found');
            return false;
        }

        return verifyRawPriceDataSign(priceData)
    }
}

/* export function verifyPricesAssets(assets: PoolAssetsConfig) {
    return function(priceData: RawPriceData): boolean {
        for (const asset of assets) {
            if(!priceData.dict.has(asset.assetId)) {
                return false;
            }
        }
        return true;
    }
} */

export function getMedianPrice(pricesData: PriceData[], asset: bigint): bigint | null {
    try {
        const sorted = pricesData.map(x => x.dict.get(asset)!).sort((a, b) => Number(a) - Number(b));
        
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

export function packPrices(assetsDataCell: Cell, oraclesDataCell: Cell): Cell {
    let pricesCell = beginCell()
      .storeRef(assetsDataCell)
      .storeRef(oraclesDataCell)
    .endCell();
    return pricesCell;
}

export function createOracleDataProof(oracle: Oracle, 
    data: OraclePricesData, 
    signature: Buffer,
    assets: Array<bigint>): Slice {
    let prunedDict = generateMerkleProofDirect(data.prices, assets, Dictionary.Keys.BigUint(256));
    let prunedData = beginCell().storeUint(data.timestamp, 32).storeMaybeRef(prunedDict).endCell();
    let merkleProof = convertToMerkleProof(prunedData);
    let oracleDataProof = beginCell().storeUint(oracle.id, 32).storeRef(merkleProof).storeBuffer(signature).asSlice();
    return oracleDataProof;
}

export function packOraclesData(oraclesData: {oracle: Oracle, data: OraclePricesData, signature: Buffer}[], 
    assets: Array<bigint>): Cell {
    if (oraclesData.length == 0) {
        throw new Error("no oracles data to pack");
    }
    let proofs = oraclesData.sort((d1, d2) => d1.oracle.id - d2.oracle.id).map(
        ({oracle, data, signature}) => createOracleDataProof(oracle, data, signature, assets)
    );
    return proofs.reduceRight((acc: Cell | null, val) => beginCell().storeSlice(val).storeMaybeRef(acc).endCell(), null)!;
}

export function sumDicts(result: Dictionary<bigint, bigint>, addendum: Dictionary<bigint, bigint>) {
    for (const key of addendum.keys()) {
        const current = result.get(key)!;
        const value = addendum.get(key)!;

        if (current === undefined) {
            result.set(key, value);
            continue;
        }

        result.set(key, current + value);
    }
}

export function generatePriceSources(config: PriceSourcesConfig = DefaultPriceSourcesConfig, nfts: OracleNFT[] = MAINNET_POOL_CONFIG.oracles) {
    let result: PriceSource[] = config.backendEndpoints.map(x => new BackendPriceSource(x, nfts));

    result.push(...config.icpEndpoints.map(x => new IcpPriceSource(x, nfts)));
    result.push(...config.iotaEndpoints.map(x => new IotaPriceSource(x, nfts)));

    return result;
}

export async function collectAndFilterPrices(priceSource: PriceSource, poolConfig: PoolConfig): Promise<RawPriceData[]> {
    const prices = await priceSource.getPrices();
         
    //console.debug('[FILTERING] before filtering prices len ', priceSource.sourceName, prices.length);
    return await (async () => {
            const acceptedPrices: RawPriceData[] = prices.filter(
            price => verifyPricesTimestamp()(price) && verifyPricesSign(poolConfig.oracles)(price)
        );

        //console.debug('[FILTERING] after filtering prices len ', priceSource.sourceName, acceptedPrices.length);

        if (acceptedPrices.length < poolConfig.minimalOracles) {
            throw new Error("Prices are outdated");
        }

        return acceptedPrices;
    })();
}

export function unpackMedianPrices(pricesCell: Cell): Dictionary<bigint, bigint> | undefined {
    if (!pricesCell) return undefined;
    const slice = pricesCell.beginParse();
    let assetCell: Cell | null = slice.loadRef();
    const res = Dictionary.empty<bigint, bigint>();
    while (assetCell != Cell.EMPTY && assetCell !== null) {
        const slice = assetCell.beginParse();
        const assetId = slice.loadUintBig(256);
        const medianPrice = slice.loadCoins();
        res.set(assetId, medianPrice);
        assetCell = slice.loadMaybeRef();
    }
    return res;
}

export function verifyRawPriceDataSign(priceData: RawPriceData): boolean {
    const message = priceData.dataCell.refs[0].hash()
    const signature = priceData.signature;
    const publicKey = priceData.pubkey;

    const valid: boolean = signVerify(message, signature, publicKey);
    //console.debug('[verifyRawPriceDataSign] sign is valid:', valid);

    return valid;
}
