import { Cell, Dictionary } from '@ton/core';
import { PoolAssetConfig } from '../../types/Master';

/**
 * Basic price data structure
 * Simplified version of RawPriceData for internal processing
 */
export interface PriceData {
    /** Dictionary mapping asset IDs to their prices */
    readonly dict: Dictionary<bigint, bigint>;
    /** Serialized data cell containing price information uses for smartcontract */
    readonly dataCell: Cell;
}

/**
 * Configuration interface for timestamp boundaries
 * Used to filter price data based on publish time
 */
export interface TimestampBoundaries {
    /** Maximum valid time for price data in seconds */
    readonly minPublishTime?: number;
    /** Minimum valid time for price data in seconds */
    readonly maxPublishTime?: number;
}

export type PriceParameters = PriceData & TimestampBoundaries;

export abstract class AbstractPrices {
    constructor(protected readonly parameters: PriceParameters) {}

    get dict() {
        const dict = Dictionary.empty<bigint, bigint>();
        for (const [key, value] of this.parameters.dict) {
            dict.set(key, value);
        }
        return dict;
    }

    get dataCell() {
        return new Cell(this.parameters.dataCell);
    }

    getAssetPrice<T extends bigint | PoolAssetConfig>(asset: T): bigint | undefined {
        const assetId = this.#extractAssetId(asset);
        return this.parameters.dict.get(assetId);
    }

    #extractAssetId(asset: bigint | PoolAssetConfig): bigint {
        return typeof asset === 'bigint' ? asset : asset.assetId;
    }

    get minPublishTime() {
        return this.parameters.minPublishTime;
    }

    get maxPublishTime() {
        return this.parameters.maxPublishTime;
    }
}
