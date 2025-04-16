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
} from '@ton/ton';
import { Maybe } from '@ton/ton/dist/utils/maybe';
import { FEES, OPCODES } from '../constants/general';
import { EvaaRewardsConfig } from '../types/MasterRewards';
import { bigIntToBuffer } from '../utils/sha256BigInt';

export class RewardMaster implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: Maybe<StateInit>,
    ) {}

    static createFromAddress(address: Address) {
        return new RewardMaster(address);
    }

    static rewardMasterConfigToCell(config: EvaaRewardsConfig): Cell {
        return beginCell()
            .storeAddress(config.adminAddress)
            .storeCoins(config.availableReward)
            .storeAddress(null) // The addres null for TON
            .storeRef(config.rewardUserCode)
            .storeRef(
                beginCell()
                    .storeAddress(config.evaaMasterAddress)
                    .storeBuffer(bigIntToBuffer(config.asset.assetId), 256 / 8)
                    .storeBuffer(config.publicKey, 256 / 8)
                    .endCell(),
            )
            .endCell();
    }

    static createFromConfig(config: EvaaRewardsConfig, workchain = 0) {
        const data = this.rewardMasterConfigToCell(config);
        const init = { code: config.rewardMasterCode, data };
        return new RewardMaster(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, rewardTokenJettonWalletAddress: Address | null) {
        await provider.internal(via, {
            value: FEES.REWARD_MASTER_DEPLOY,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(1, 32).storeUint(0, 64).storeAddress(rewardTokenJettonWalletAddress).endCell(),
        });
    }

    async sendTonTopUp(provider: ContractProvider, via: Sender, topUpRewardAmount: number) {
        await provider.internal(via, {
            value: toNano(topUpRewardAmount) + FEES.REWARD_MASTER_TON_TOP_UP,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.REWARD_TON_TOP_UP, 32).storeUint(0, 64).endCell(),
        });
    }

    private adminWithdrawMessage(destinationAddress: Address, jettonAmount: number) {
        return beginCell()
            .storeUint(4, 32)
            .storeUint(0, 64)
            .storeAddress(destinationAddress)
            .storeCoins(toNano(jettonAmount))
            .endCell();
    }

    async sendAdminWithdraw(
        provider: ContractProvider,
        via: Sender,
        destinationAddress: Address,
        jettonAmount: number,
    ) {
        await provider.internal(via, {
            value: FEES.REWARD_MASTER_WITHDRAW,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: this.adminWithdrawMessage(destinationAddress, jettonAmount),
        });
    }

    async getData(provider: ContractProvider) {
        const result = await provider.get('load_data', []);
        const data = {
            // TODO: maybe it will be typed
            adminAddress: result.stack.readAddress(),
            availableReward: Number(fromNano(result.stack.readBigNumber())),
            rewardUserCode: result.stack.readCell(),
            evaaMasterAddress: result.stack.readAddress(),
            rewardTokenJettonWalletAddress: result.stack.readAddressOpt(),
            assetId: Buffer.from(result.stack.readBigNumber().toString(16), 'hex'),
            publicKey: Buffer.from(result.stack.readBigNumber().toString(16), 'hex'),
        };
        return data;
    }

    async getRewardUserAddress(provider: ContractProvider, userAddress: Address): Promise<Address> {
        const result = await provider.get('calculate_reward_user_address', [
            { type: 'slice', cell: beginCell().storeAddress(userAddress).endCell() },
        ]);
        return result.stack.readAddress();
    }
}
