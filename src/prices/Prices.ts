import { Cell, Dictionary } from '@ton/core';
import { PoolAssetConfig } from '../types/Master';

export class Prices {
    #dict: Dictionary<bigint, bigint>;
    #dataCell: Cell;
    #minPublishTime?: bigint;
    #maxPublishTime?: bigint;

    constructor(dict: Dictionary<bigint, bigint>, dataCell: Cell, minPublishTime?: bigint, maxPublishTime?: bigint) {
        this.#dict = dict;
        this.#dataCell = dataCell;
        this.#minPublishTime = minPublishTime;
        this.#maxPublishTime = maxPublishTime;
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

    get minPublishTime(): bigint | undefined {
        return this.#minPublishTime;
    }

    get maxPublishTime(): bigint | undefined {
        return this.#maxPublishTime;
    }

    getAssetPrice<T extends bigint | PoolAssetConfig>(asset: T): bigint | undefined {
        const assetId = this.#extractAssetId(asset);
        return this.#dict.get(assetId);
    }

    #extractAssetId(asset: bigint | PoolAssetConfig): bigint {
        return typeof asset === 'bigint' ? asset : asset.assetId;
    }
}
