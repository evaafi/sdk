import { Slice } from '@ton/core';

export interface OracleParser {
    parseOracleConfig(masterConfigSlice: Slice): any;
    getIfActive(masterConfigSlice: Slice): number;
}

export abstract class AbstractOracleParser implements OracleParser {
    abstract parseOracleConfig(masterConfigSlice: Slice): any;

    getIfActive(masterConfigSlice: Slice): number {
        return masterConfigSlice.loadInt(8);
    }
}
