import { Address, Cell, Contract, ContractProvider, OpenedContract } from '@ton/core';
import { RewardMaster } from './RewardMaster';

export type EvaaMasterRewardsConfig = {
    workchain?: number;
    adminAddress: Address;
    evaaMasterAddress: Address;
    availableReward: number;
    rewardTokenJettonWalletAddress: Address | null;
    assetId: Buffer;
    publicKey: Buffer;
    rewardMasterCode: Cell;
    rewardUserCode: Cell;
};

export class EvaaMasterRewards implements Contract {
    readonly address: Address;
    constructor(readonly config: EvaaMasterRewardsConfig) {
        this.address = config.adminAddress;
    }

    openMasterContract(provider: ContractProvider): OpenedContract<RewardMaster> {
        return provider.open(
            RewardMaster.createFromConfig(this.config, this.config.rewardMasterCode, (this.config.workchain = 0)),
        );
    }
}
