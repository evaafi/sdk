import { beginCell, Cell, Dictionary } from "@ton/core";
import { PriceSource } from "./PriceSource";
import { RawPriceData } from "..";

export class IotaPriceSource extends PriceSource {
    protected priceSourceName: string = 'IotaPriceSource';

    async getPrices(): Promise<RawPriceData[]> {
        return await Promise.all(this.nfts.map(nft => this.loadOracleData(nft.address)
                .then(x => this.parsePrices(x, nft.id))));
    }

    async loadOracleData(oracleNftId: String): Promise<OutputData> {
        let result = await fetch(`https://${this._endpoint}/api/indexer/v1/outputs/nft/${oracleNftId}`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        let outputId = (await result.json()) as NftData;

        result = await fetch(`https://${this._endpoint}/api/core/v2/outputs/${outputId.items[0]}`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        return (await result.json() as OutputData);
    }


    parsePrices(outputData: OutputData, oracleId: number): RawPriceData {
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
            //console.debug(`Price source error ${this.priceSourceName} ${outputData} ${error}`);
            throw error;
        }
    }
}

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
