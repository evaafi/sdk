import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/ton';
import { OPCODES } from '../constants/general';

export type JettonWalletConfig = {
    owner: Address;
    minter: Address;
    walletCode: Cell;
};

export class JettonWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    static jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
        return beginCell()
            .storeCoins(0) // baseTrackingAccured always is 0, check smartcontract
            .storeAddress(config.owner)
            .storeAddress(config.minter)
            .storeRef(config.walletCode)
            .endCell();
    }

    static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
        const data = this.jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        forwardValue: bigint,
        recipient: Address,
        amount: bigint,
        forwardPayload: Cell,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.REWARD_JETTON_TRANSFER, 32)
                .storeUint(0, 64)
                .storeCoins(amount)
                .storeAddress(recipient)
                .storeAddress(via.address)
                .storeUint(0, 1)
                .storeCoins(forwardValue)
                .storeUint(1, 1)
                .storeRef(forwardPayload)
                .endCell(),
            value: value + forwardValue,
        });
    }

    async getJettonBalance(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0n;
        }
        let res = await provider.get('get_wallet_data', []);
        return res.stack.readBigNumber();
    }
}
