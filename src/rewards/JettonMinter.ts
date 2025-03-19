import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/ton';
import { OPCODES } from '../constants/general';

export type JettonMinterConfig = {
    address: Address;
    content: Cell;
    walletCode: Cell;
};

export type MintMessage = {
    address: Address;
    forwardValue: bigint;
    amount: bigint;
};

export class JettonMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
        return beginCell()
            .storeCoins(0)
            .storeAddress(config.address)
            .storeRef(config.content)
            .storeRef(config.walletCode)
            .endCell();
    }

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = this.jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    sendMintMessage(payload: MintMessage) {
        return beginCell()
            .storeUint(21, 32)
            .storeUint(0, 64)
            .storeAddress(payload.address)
            .storeCoins(payload.forwardValue)
            .storeRef(
                beginCell()
                    .storeUint(OPCODES.REWARD_JETTON_MINT, 32)
                    .storeUint(0, 64)
                    .storeCoins(payload.amount)
                    .storeAddress(this.address)
                    .storeAddress(this.address)
                    .storeCoins(0)
                    .storeUint(0, 1)
                    .endCell(),
            )
            .endCell();
    }

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        forwardValue: bigint,
        recipient: Address,
        amount: bigint,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(21, 32)
                .storeUint(0, 64)
                .storeAddress(recipient)
                .storeCoins(forwardValue)
                .storeRef(
                    beginCell()
                        .storeUint(OPCODES.REWARD_JETTON_MINT, 32)
                        .storeUint(0, 64)
                        .storeCoins(amount)
                        .storeAddress(this.address)
                        .storeAddress(this.address)
                        .storeCoins(0)
                        .storeUint(0, 1)
                        .endCell(),
                )
                .endCell(),
            value: value + forwardValue,
        });
    }

    async getWalletAddressOf(provider: ContractProvider, address: Address) {
        return (
            await provider.get('get_wallet_address', [
                { type: 'slice', cell: beginCell().storeAddress(address).endCell() },
            ])
        ).stack.readAddress();
    }

    async getWalletCode(provider: ContractProvider) {
        let stack = (await provider.get('get_jetton_data', [])).stack;
        stack.skip(4);
        return stack.readCell();
    }
}
