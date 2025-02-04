import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    fromNano,
    Sender,
    SendMode,
    StateInit,
    toNano,
} from '@ton/core';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { sign } from '@ton/crypto';
import { FEES } from '../constants/general';

export type RewardUserConfig = {
    userAddress: Address;
    baseTrackingAccrued: number;
    rewardMasterAddress: Address;
    assetId: Buffer;
    publicKey: Buffer;
};

export class RewardUser implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: Maybe<StateInit>,
    ) {}

    static createFromAddress(address: Address) {
        return new RewardUser(address);
    }

    static rewardUserConfigToCell(config: RewardUserConfig): Cell {
        return beginCell()
            .storeAddress(config.userAddress)
            .storeCoins(config.baseTrackingAccrued)
            .storeRef(
                beginCell()
                    .storeAddress(config.rewardMasterAddress)
                    .storeBuffer(config.assetId, 256 / 8)
                    .storeBuffer(config.publicKey, 256 / 8)
                    .endCell(),
            )
            .endCell();
    }

    static createFromConfig(config: RewardUserConfig, code: Cell, workchain = 0) {
        const data = this.rewardUserConfigToCell(config);
        const init = { code, data };
        return new RewardUser(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: FEES.REWARD_MASTER_DEPLOY,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    signClaimMessage(assetId: Buffer, claimAmount: bigint, privateKey: Buffer): Cell {
        const claimBody = beginCell()
            .storeBuffer(assetId, 256 / 8)
            .storeCoins(toNano(claimAmount))
            .endCell();

        return beginCell()
            .storeUint(2, 32)
            .storeUint(0, 64)
            .storeBuffer(sign(claimBody.hash(), privateKey))
            .storeRef(claimBody)
            .endCell();
    }

    async sendClaim(provider: ContractProvider, via: Sender, signedClaimMessage: Cell) {
        await provider.internal(via, {
            value: FEES.REWARD_USER_CLAIM,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: signedClaimMessage,
        });
    }

    async getData(provider: ContractProvider) {
        const result = await provider.get('load_data', []);
        const data: RewardUserConfig = {
            userAddress: result.stack.readAddress(),
            baseTrackingAccrued: Number(fromNano(result.stack.readBigNumber())),
            rewardMasterAddress: result.stack.readAddress(),
            assetId: Buffer.from(result.stack.readBigNumber().toString(16), 'hex'),
            publicKey: Buffer.from(result.stack.readBigNumber().toString(16), 'hex'),
        };
        return data;
    }
}
