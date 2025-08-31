import { Cell, Slice } from '@ton/ton';
import { loadMaybeMyRef } from '../helpers';
import { AbstractOracleParser } from './AbstractParser';

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
