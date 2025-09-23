import { RawPriceData } from "..";
import { ExtendedEvaaOracle } from "../../types/Master";
import { FetchConfig } from "../../utils/utils";

export abstract class PriceSource {
    protected priceSourceName: string = 'BackendPriceSource';
    protected _endpoint: string;
    protected _nfts: ExtendedEvaaOracle[];

    constructor(endpoint: string, nfts: ExtendedEvaaOracle[]) {
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

    set nfts(nfts: ExtendedEvaaOracle[]) {
        this._nfts = nfts; 
    }

    abstract getPrices(fetchConfig?: FetchConfig): Promise<RawPriceData[]>;
}