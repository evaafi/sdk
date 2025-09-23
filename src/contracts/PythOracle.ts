import { calculateUpdatePriceFeedsFee, createCellChain } from '@pythnetwork/pyth-ton-js';
import { Address, Cell, Contract, ContractProvider } from '@ton/core';

export class PythOracle implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new this(address);
    }

    async getUpdateFee(provider: ContractProvider, vm: Buffer) {
        const result = await provider.get('get_update_fee', [{ type: 'slice', cell: createCellChain(vm) }]);
        const numUpdates = result.stack.readNumber();

        return calculateUpdatePriceFeedsFee(BigInt(numUpdates)) + BigInt(numUpdates);
    }
}
