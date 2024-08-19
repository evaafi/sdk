import { Cell, Dictionary } from '@ton/core';

export type RawPriceData = {
    dict: Dictionary<bigint, bigint>;
    dataCell: Cell;
    oracleId: number;
    signature: Buffer;
    pubkey: Buffer;
    timestamp: number;
};


export type PriceData = {
    dict: Dictionary<bigint, bigint>;
    dataCell: Cell;
};
