import { Cell, Dictionary } from "@ton/core";
import { PoolAssetConfig } from "../types/Master";

export class Prices {
    #dict: Dictionary<bigint, bigint>;
    #dataCell: Cell;
    constructor(dict: Dictionary<bigint, bigint>, dataCell: Cell) {
        this.#dict = dict;
        this.#dataCell = dataCell;
    }

    get dict() {
        const dict = Dictionary.empty<bigint, bigint>();
        for (const [key, value] of this.#dict) {
            dict.set(key, value);
        }
        return dict;
    }

    get dataCell() {
        return new Cell(this.#dataCell);
    }

    getAssetPrice<T extends bigint | PoolAssetConfig>(asset: T): bigint | undefined {
        const assetId = this.#extractAssetId(asset);
        return this.#dict.get(assetId);
    }

    #extractAssetId(asset: bigint | PoolAssetConfig): bigint {
        return typeof asset === 'bigint' ? asset : asset.assetId;
    }
}