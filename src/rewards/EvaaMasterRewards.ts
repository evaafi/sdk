import { Address, Contract, ContractProvider, OpenedContract } from '@ton/ton';
import { EvaaMasterRewardsConfig } from '../types/MasterRewards';
import { RewardMaster } from './RewardMaster';

export class EvaaMasterRewards implements Contract {
    readonly address: Address;
    constructor(readonly config: EvaaMasterRewardsConfig) {
        this.address = RewardMaster.createFromConfig(this.config, (this.config.workchain = 0)).address;
    }

    openMasterContract(provider: ContractProvider): OpenedContract<RewardMaster> {
        return provider.open(RewardMaster.createFromConfig(this.config, (this.config.workchain = 0)));
    }
}
