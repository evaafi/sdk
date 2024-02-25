export type CoinData = {
    id: string;
    symbol: string;
    provider: string;
    value: number;
    liteEvmSignature: string;
    permawebTx: string;
    version: string;
    source: {
        coingecko: number;
    };
    timestamp: number;
    minutes: number;
    providerPublicKey: string;
};
