import { beginCell, Cell, Dictionary, Slice } from "@ton/core";
import { PriceData, RawPriceData } from "../types/Common";
import { TTL_ORACLE_DATA_SEC } from "../config";
import { Oracle, PoolAssetsConfig } from "../types/Master";
import { convertToMerkleProof, generateMerkleProofDirect } from "./merkleProof";

type NftData = {
    ledgerIndex: number;
    pageSize: number;
    items: string[];
};

type OutputData = {
    metadata: {
        blockId: string;
        transactionId: string;
        outputIndex: number;
        isSpent: boolean;
        milestoneIndexSpent: number;
        milestoneTimestampSpent: number;
        transactionIdSpent: string;
        milestoneIndexBooked: number;
        milestoneTimestampBooked: number;
        ledgerIndex: number;
    };
    output: {
        type: number;
        amount: string;
        nftId: string;
        unlockConditions: {
            type: number;
            address: {
                type: number;
                pubKeyHash: string;
            };
        }[];
        features: {
            type: number;
            data: string;
        }[];
    };
};

export type OraclePricesData = {
    timestamp: number, 
    prices: Dictionary<bigint, bigint>
}

export async function loadPrices(oracleNftId: String, endpoints: String[]): Promise<OutputData> {
    return await Promise.any(endpoints.map(x => loadOracleData(oracleNftId, x)));
}


async function loadOracleData(oracleNftId: String, endpoint: String): Promise<OutputData> {
    let result = await fetch(`https://${endpoint}/api/indexer/v1/outputs/nft/${oracleNftId}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
    });
    let outputId = (await result.json()) as NftData;

    result = await fetch(`https://${endpoint}/api/core/v2/outputs/${outputId.items[0]}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
    });
    return (await result.json() as OutputData);
}

export async function parsePrices(outputData: OutputData, oracleId: number): Promise<RawPriceData>{
    const data = JSON.parse(
        decodeURIComponent(outputData.output.features[0].data.replace('0x', '').replace(/[0-9a-f]{2}/g, '%$&')),
    );
 
    try {
        const pricesCell = Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex'))[0];
        const signature = Buffer.from(data['signature'], 'hex');
        const publicKey = Buffer.from(data['publicKey'], 'hex');
        const timestamp = Number(data['timestamp']);

        return {
            dict: pricesCell.beginParse().loadRef().beginParse().loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigVarUint(4)),
            dataCell: beginCell().storeRef(pricesCell).storeBuffer(signature).endCell(),
            oracleId: oracleId,
            signature: signature,
            pubkey: publicKey,
            timestamp: timestamp,
        };
    }
    catch (error) {
        console.log(oracleId, data, error);
        throw Error();
    }
}

export function verifyPrices(assets: PoolAssetsConfig) {
    return function(priceData: RawPriceData): boolean {
        const timestamp = Date.now() / 1000;
        const pricesTime = priceData.timestamp;

        for (const asset of assets) {
            if(!priceData.dict.has(asset.assetId)) {
                return false;
            }
        }
        // console.log('timestamp', timestamp, 'pricestime', pricesTime, timestamp - pricesTime);
        return timestamp - pricesTime < TTL_ORACLE_DATA_SEC;
    }
}

export function getMedianPrice(pricesData: PriceData[], asset: bigint): bigint {
    const sorted = pricesData.map(x => x.dict.get(asset)!).sort((a, b) => Number(a) - Number(b));
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2n;
    } else {
        return sorted[mid];
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


// : String = "api.stardust-mainnet.iotaledger.net"
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
