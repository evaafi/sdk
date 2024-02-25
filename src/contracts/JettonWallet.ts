import { Address, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

export class JettonWallet implements Contract {
    readonly address: Address;
    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    private constructor(address: Address) {
        this.address = address;
    }

    async sendTransfer(provider: ContractProvider, via: Sender, value: bigint, payload: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: payload,
        });
    }
}
