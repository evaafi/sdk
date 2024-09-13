import { beginCell, Cell, Dictionary } from '@ton/core';
import { PriceData } from '../types/Common';
import { MAIN_POOL_NFT_ID } from '../constants/general';

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
}

export async function getPrices(endpoints: string[] = ["api.stardust-mainnet.iotaledger.net"], nftId: string = MAIN_POOL_NFT_ID) {
    return await Promise.any(endpoints.map(x => loadPrices(nftId, x)));
}

async function loadPrices(nftId: string, endpoint: string = "api.stardust-mainnet.iotaledger.net"): Promise<PriceData> {
    let result = await fetch(`https://${endpoint}/api/indexer/v1/outputs/nft/${nftId}`, {
        headers: { accept: 'application/json' },
    });
    let outputId = (await result.json()) as NftData;

    result = await fetch(`https://${endpoint}/api/core/v2/outputs/${outputId.items[0]}`, {
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
}
