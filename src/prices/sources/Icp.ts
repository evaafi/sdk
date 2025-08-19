import { BackendPriceSource } from ".";
import { FetchConfig, proxyFetchRetries, DefaultFetchConfig } from "../../utils/utils";

export class IcpPriceSource extends BackendPriceSource {
    protected priceSourceName: string = 'IcpPriceSource';

    async loadOracleData(fetchConfig: FetchConfig = DefaultFetchConfig): Promise<OutputData[]> {
        const fetchPromise = fetch(`https://${this._endpoint}/prices`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(fetchConfig.timeout)
        }).then(async (response) => {
            const data = (await response.json()) as Record<string, string>;

            let outputData: OutputData[] = [];

            for (const nft of this._nfts) {
                outputData.push({oracleId: nft.id, data: data[nft.address] })
            }

            return outputData;
        });

        return await proxyFetchRetries(fetchPromise, fetchConfig);
    }
}

type OutputData = {
    oracleId: number,
    data: string
};
