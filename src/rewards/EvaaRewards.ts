import { Address, Contract } from '@ton/ton';
import { EvaaRewardsConfig } from '../types/MasterRewards';
import { RewardUser } from './RewardUser';

export class EvaaUserRewards implements Contract {
    readonly address: Address;
    constructor(
        readonly userAddress: Address,
        readonly config: Omit<EvaaRewardsConfig, 'userAddress'>,
    ) {
        this.address = this.userAddress;
    }

    openContract() {
        return RewardUser.createFromConfig({
            asset: this.config.asset,
            rewardMasterAddress: this.config.adminAddress,
            rewardUserCode: this.config.rewardUserCode,
            userAddress: this.userAddress,
            publicKey: this.config.publicKey,
        });
    }
}
