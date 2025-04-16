import { sign } from '@ton/crypto';
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
} from '@ton/ton';
import { Maybe } from '@ton/ton/dist/utils/maybe';
import { FEES, OPCODES } from '../constants/general';
import { EvaaUserRewardsConfig } from '../types/UserRewards';
import { bigIntToBuffer } from '../utils/sha256BigInt';

export class RewardUser implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: Maybe<StateInit>,
    ) {}

    static createFromAddress(address: Address) {
        return new RewardUser(address);
    }

    static rewardUserConfigToCell(config: EvaaUserRewardsConfig): Cell {
        return beginCell()
            .storeAddress(config.userAddress)
            .storeCoins(0)
            .storeRef(
                beginCell()
                    .storeAddress(config.rewardMasterAddress)
                    .storeBuffer(bigIntToBuffer(config.asset.assetId), 256 / 8)
                    .storeBuffer(config.publicKey, 256 / 8)
                    .endCell(),
            )
            .endCell();
    }

    static createFromConfig(config: EvaaUserRewardsConfig, workchain = 0) {
        const data = this.rewardUserConfigToCell(config);
        const init = { code: config.rewardUserCode, data };
        return new RewardUser(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: FEES.REWARD_MASTER_DEPLOY,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    claimMessageToCell(claimAmount: bigint): Cell {
        return beginCell().storeAddress(this.address).storeCoins(claimAmount).endCell();
    }

    signClaimMessage(claimBody: Cell, privateKey: Buffer): Cell {
        return beginCell()
            .storeUint(OPCODES.REWARD_CLAIM, 32)
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
        // TODO: maybe it will be typed
        const data = {
            userAddress: result.stack.readAddress(),
            baseTrackingAccrued: Number(fromNano(result.stack.readBigNumber())),
            rewardMasterAddress: result.stack.readAddress(),
            assetId: Buffer.from(result.stack.readBigNumber().toString(16), 'hex'),
            publicKey: Buffer.from(result.stack.readBigNumber().toString(16), 'hex'),
        };
        return data;
    }
}
