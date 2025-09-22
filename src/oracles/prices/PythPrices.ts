import { HexString } from '@pythnetwork/hermes-client';
import { Cell, Dictionary } from '@ton/core';
import { PoolAssetConfig } from '../../types/Master';
import { AbstractPrices, PriceParameters } from './AbstractPrices';

export interface PythPricesParams extends PriceParameters {
    targetFeeds: HexString[];
    requestedRefTokens: PoolAssetConfig[];
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
            requestedRefTokens: [],
        });
    }

    requestedRefTokens(): PoolAssetConfig[] {
        return this.params.requestedRefTokens;
    }

    composedFeeds(): Cell {
        return Cell.EMPTY;
    }
}
