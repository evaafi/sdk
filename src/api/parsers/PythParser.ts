import { Address, Dictionary, Slice } from '@ton/ton';
import { AbstractOracleParser } from './AbstractParser';

export type OracleConfig = {
    pythAddress: Address;
    // FYI: The Pyth max feeds count is 7, but it can add more in the future
    feedsMap: Dictionary<bigint, Buffer>;
    allowedRefTokens: Dictionary<bigint, bigint>;
};

export type PythOracleInfo = OracleConfig & {
    pricesTtl: number;
    pythComputeBaseGas: bigint;
    pythComputePerUpdateGas: bigint;
    pythSingleUpdateFee: bigint;
};

export class PythOracleParser extends AbstractOracleParser {
    parseOracleConfig(masterConfigSlice: Slice): PythOracleInfo {
        const oraclesSlice = masterConfigSlice.loadRef().beginParse();
        const feedDataCell = oraclesSlice.loadRef();
        const feedDataSlice = feedDataCell.beginParse();

        return {
            pythAddress: oraclesSlice.loadAddress(),
            feedsMap: feedDataSlice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Buffer(64)),
            allowedRefTokens: feedDataSlice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(256)),
            pricesTtl: oraclesSlice.loadUint(32),
            pythComputeBaseGas: oraclesSlice.loadUintBig(64),
            pythComputePerUpdateGas: oraclesSlice.loadUintBig(64),
            pythSingleUpdateFee: oraclesSlice.loadUintBig(64),
        };
    }
}
