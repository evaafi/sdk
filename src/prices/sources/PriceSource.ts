import { RawPriceData } from "..";
import { OracleNFT } from "../../types/Master";

export abstract class PriceSource {
    protected priceSourceName: string = 'BackendPriceSource';
    protected _endpoint: string;
    protected _nfts: OracleNFT[];

    constructor(endpoint: string, nfts: OracleNFT[]) {
        this._endpoint = endpoint;
        this._nfts = nfts;
    }

    get sourceName() {
        return this.priceSourceName;
    }

    get endpoint() {
        return this._endpoint;
    }

    get nfts() {
        return this._nfts;
    }

    set endpoint(endpoint: string) {
        this._endpoint = endpoint; 
    }

    set nfts(nfts: OracleNFT[]) {
        this._nfts = nfts; 
    }

    abstract getPrices(): Promise<RawPriceData[]>;
}