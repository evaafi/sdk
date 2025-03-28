import { Address, Contract, ContractProvider } from '@ton/ton';
import { EvaaUserRewardsConfig } from '../types/UserRewards';
import { RewardUser } from './RewardUser';

export class EvaaUserRewards implements Contract {
    readonly address: Address;
    constructor(
        readonly userAddress: Address,
        readonly config: EvaaUserRewardsConfig,
    ) {
        this.address = this.userAddress;
    }

    openUserContract(provider: ContractProvider) {
        return provider.open(
            RewardUser.createFromConfig({
                asset: this.config.asset,
                rewardMasterAddress: this.config.rewardMasterAddress,
                rewardUserCode: this.config.rewardUserCode,
                userAddress: this.userAddress,
                publicKey: this.config.publicKey,
            }),
        );
    }
}
