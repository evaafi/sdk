import { beginCell, Cell, Dictionary } from '@ton/core';
import { NFT_ID } from '../constants';
import { PriceData } from '../types/Common';

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

export async function getPrices(): Promise<PriceData | undefined> {
    try {
        let result = await fetch('https://api.stardust-mainnet.iotaledger.net/api/indexer/v1/outputs/nft/' + NFT_ID, {
            headers: { accept: 'application/json' },
        });
        let outputId = (await result.json()) as NftData;

        result = await fetch('https://api.stardust-mainnet.iotaledger.net/api/core/v2/outputs/' + outputId.items[0], {
            headers: { accept: 'application/json' },
        });

        let resData = (await result.json()) as OutputData;

        const data = JSON.parse(
            decodeURIComponent(resData.output.features[0].data.replace('0x', '').replace(/[0-9a-f]{2}/g, '%$&')),
        );

        const pricesCell = Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex'))[0];
        const signature = Buffer.from(data['signature'], 'hex');

        return {
            dict: pricesCell.beginParse().loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64)),
            dataCell: beginCell().storeRef(pricesCell).storeBuffer(signature).endCell(),
        };
    } catch (error) {
        console.error(error);
        return undefined;
    }
}
