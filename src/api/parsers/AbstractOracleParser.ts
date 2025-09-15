import { Slice } from '@ton/core';
import { ClassicOracleInfo } from './ClassicOracleParser';
import { PythOracleInfo } from './PythOracleParser';

export interface OracleParser {
    parseOracleConfig(masterConfigSlice: Slice): ClassicOracleInfo | PythOracleInfo;
    getIfActive(masterConfigSlice: Slice): number;
}

export abstract class AbstractOracleParser implements OracleParser {
    abstract parseOracleConfig(masterConfigSlice: Slice): ClassicOracleInfo | PythOracleInfo;

    getIfActive(masterConfigSlice: Slice): number {
        return masterConfigSlice.loadInt(8);
    }
}
