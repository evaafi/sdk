import { Cell, Dictionary } from '@ton/core';
import { AbstractPrices, PriceParameters } from './AbstractPrices';

export enum PricesMode {
    SPOT = 'spot',
    TWAP = 'twap',
}

export interface ClassicPricesConfig extends PriceParameters {
    readonly mode: PricesMode;
}

export class ClassicPrices extends AbstractPrices {
    constructor(parameters: ClassicPricesConfig) {
        super(parameters);
    }

    static createEmptyTwapPrices(): ClassicPrices {
        return this.createEmptyPrices({ mode: PricesMode.TWAP });
    }

    static createEmptySpotPrices(): ClassicPrices {
        return this.createEmptyPrices({ mode: PricesMode.SPOT });
    }

    static createEmptyPrices(params: { mode: PricesMode }): ClassicPrices {
        return new ClassicPrices({
            mode: params.mode,
            dict: Dictionary.empty<bigint, bigint>(),
            dataCell: Cell.EMPTY,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }
}
