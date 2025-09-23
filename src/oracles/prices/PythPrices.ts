import { HexString } from '@pythnetwork/hermes-client';
import { Cell, Dictionary } from '@ton/core';
import { PoolAssetConfig } from '../../types/Master';
import { AbstractPrices, PriceParameters } from './AbstractPrices';

export interface PythPricesParams extends PriceParameters {
    targetFeeds: HexString[];
    refAssets: PoolAssetConfig[];
    binaryUpdate: Buffer;
}

export class PythPrices extends AbstractPrices {
    constructor(private readonly params: PythPricesParams) {
        super(params);
    }

    static createEmptyPrices(): PythPrices {
        return new PythPrices({
            dict: Dictionary.empty<bigint, bigint>(),
            dataCell: Cell.EMPTY,
            minPublishTime: undefined,
            maxPublishTime: undefined,
            targetFeeds: [],
            refAssets: [],
            binaryUpdate: Buffer.alloc(0),
        });
    }

    refAssets(): PoolAssetConfig[] {
        return this.params.refAssets;
    }

    targetFeeds(): HexString[] {
        return this.params.targetFeeds;
    }

    binaryUpdate(): Buffer {
        return this.params.binaryUpdate;
    }
}
