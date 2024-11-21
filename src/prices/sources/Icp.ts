import { BackendPriceSource } from ".";

export class IcpPriceSource extends BackendPriceSource {
    protected priceSourceName: string = 'IcpPriceSource';

    async loadOracleData(): Promise<OutputData[]> {
        let response = await fetch(`https://${this._endpoint}/prices`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5000)
        });

        const data = (await response.json()) as Record<string, string>;

        let outputData: OutputData[] = [];

        for (const nft of this._nfts) {
            outputData.push({oracleId: nft.id, data: data[nft.address] })
        }

        return outputData;
    }
}

type OutputData = {
    oracleId: number,
    data: string
};
