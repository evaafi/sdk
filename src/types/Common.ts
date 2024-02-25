import { Cell, Dictionary } from '@ton/core';

export type PriceData = {
    dict: Dictionary<bigint, bigint>;
    dataCell: Cell;
};
