import { beginCell, Cell, Dictionary } from '@ton/core';
import { RawPriceData } from '..';
import { DefaultFetchConfig, FetchConfig, proxyFetchRetries } from '../../utils/utils';
import { PriceSource } from './PriceSource';

export class BackendPriceSource extends PriceSource {
    protected priceSourceName: string = 'BackendPriceSource';

    async getPrices(fetchConfig?: FetchConfig): Promise<RawPriceData[]> {
        const data = await this.loadOracleData(fetchConfig);
        return data.map((outputData) => this.parsePrices(outputData));
    }

    async loadOracleData(fetchConfig: FetchConfig = DefaultFetchConfig): Promise<OutputData[]> {
        return await proxyFetchRetries(async () => {
            const response = await fetch(`https://${this._endpoint}/api/prices`, {
                headers: { accept: 'application/json' },
                signal: AbortSignal.timeout(fetchConfig.timeout),
            });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`HTTP error! status: ${response.status}${body ? `, body: ${body}` : ''}`);
            }
            const data = (await response.json()) as Record<string, string>;

            let outputData: OutputData[] = [];
            for (const nft of this._nfts) {
                outputData.push({ oracleId: nft.id, data: data[nft.address] });
            }
            return outputData;
        }, fetchConfig);
    }

    parsePrices(outputData: OutputData): RawPriceData {
        try {
            //console.debug('outputData', outputData);
            //console.debug(outputData.data.replace('0x', '').replace(/[0-9a-f]{2}/g, '%$&'))
            const data = JSON.parse(
                decodeURIComponent(outputData.data.replace('0x', '').replace(/[0-9a-f]{2}/g, '%$&')),
            );
            const pricesCell = Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex'))[0];
            const signature = Buffer.from(data['signature'], 'hex');
            const publicKey = Buffer.from(data['publicKey'], 'hex');
            const timestamp = Number(data['timestamp']);

            return {
                dict: pricesCell.beginParse().loadRef().beginParse().loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigVarUint(4)),
                dataCell: beginCell().storeRef(pricesCell).storeBuffer(signature).endCell(),
                oracleId: outputData.oracleId,
                signature: signature,
                pubkey: publicKey,
                timestamp: timestamp,
            };
        }
        catch (error) {
            //console.debug(`Price source error ${this.priceSourceName} ${outputData.oracleId} ${outputData.data} ${error}`);
            throw error;
        }
    }
}

type OutputData = {
    oracleId: number,
    data: string
};
