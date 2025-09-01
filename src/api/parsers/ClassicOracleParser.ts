import { Cell, Slice } from '@ton/core';
import { loadMaybeMyRef } from '../helpers';
import { AbstractOracleParser } from './AbstractOracleParser';

export type ClassicOracleInfo = {
    numOracles: number;
    threshold: number;
    oracles: Cell | null;
};

export class ClassicOracleParser extends AbstractOracleParser {
    parseOracleConfig(masterConfigSlice: Slice): ClassicOracleInfo {
        const oraclesSlice = masterConfigSlice.loadRef().beginParse();
        return {
            numOracles: oraclesSlice.loadUint(16),
            threshold: oraclesSlice.loadUint(16),
            oracles: loadMaybeMyRef(oraclesSlice),
        };
    }
}
