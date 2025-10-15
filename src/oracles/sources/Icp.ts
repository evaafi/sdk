import { BackendPriceSource } from ".";
import { FetchConfig, proxyFetchRetries, DefaultFetchConfig } from "../../utils/utils";

export class IcpPriceSource extends BackendPriceSource {
    protected priceSourceName: string = 'IcpPriceSource';

    async loadOracleData(fetchConfig: FetchConfig = DefaultFetchConfig): Promise<OutputData[]> {
        return await proxyFetchRetries(async () => {
            const response = await fetch(`https://${this._endpoint}/prices`, {
                headers: { accept: 'application/json' },
                signal: AbortSignal.timeout(fetchConfig.timeout)
            });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`HTTP error! status: ${response.status}${body ? `, body: ${body}` : ''}`);
            }
            const data = (await response.json()) as Record<string, string>;

            let outputData: OutputData[] = [];
            for (const nft of this._nfts) {
                outputData.push({oracleId: nft.id, data: data[nft.address] })
            }
            return outputData;
        }, fetchConfig);
    }
}

type OutputData = {
    oracleId: number,
    data: string
};
