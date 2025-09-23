import { Cell, Dictionary } from '@ton/core';
import { AbstractPrices, PriceParameters } from './AbstractPrices';

export enum ClassicPricesMode {
    SPOT = 'spot',
    TWAP = 'twap',
}

export interface ClassicPricesParams extends PriceParameters {
    readonly mode: ClassicPricesMode;
}

export class ClassicPrices extends AbstractPrices {
    constructor(private readonly params: ClassicPricesParams) {
        super(params);
    }

    static createEmptyTwapPrices(): ClassicPrices {
        return this.createEmptyPrices({ mode: ClassicPricesMode.TWAP });
    }

    static createEmptySpotPrices(): ClassicPrices {
        return this.createEmptyPrices({ mode: ClassicPricesMode.SPOT });
    }

    static createEmptyPrices(params: { mode: ClassicPricesMode }): ClassicPrices {
        return new ClassicPrices({
            mode: params.mode,
            dict: Dictionary.empty<bigint, bigint>(),
            dataCell: Cell.EMPTY,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }
}
