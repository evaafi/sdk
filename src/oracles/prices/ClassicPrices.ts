import { Cell, Dictionary } from '@ton/core';
import { AbstractPrices, PriceParameters } from './AbstractPrices';

export enum ClassicPricesMode {
    SPOT = 'spot',
    TWAP = 'twap',
}

export const ClassicPricesOffset = {
    [ClassicPricesMode.SPOT]: 1n,
    [ClassicPricesMode.TWAP]: 0n,
};

export interface ClassicPricesParams extends PriceParameters {
    readonly mode?: ClassicPricesMode;
}

export class ClassicPrices extends AbstractPrices {
    constructor(private readonly params: ClassicPricesParams) {
        super(params);
    }

    static createEmptyTwapPrices(): ClassicPrices {
        return new ClassicPrices({
            mode: ClassicPricesMode.TWAP,
            dict: Dictionary.empty<bigint, bigint>(),
            dataCell: Cell.EMPTY,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }

    static createEmptySpotPrices(): ClassicPrices {
        return new ClassicPrices({
            mode: ClassicPricesMode.SPOT,
            dict: Dictionary.empty<bigint, bigint>(),
            dataCell: Cell.EMPTY,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }

    static createEmptyPrices(): ClassicPrices {
        return new ClassicPrices({
            mode: undefined,
            dict: Dictionary.empty<bigint, bigint>(),
            dataCell: Cell.EMPTY,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }
}
