import { Address, beginCell, Cell, Contract, ContractProvider, Sender } from '@ton/ton';
import { EvaaUserRewardsConfig } from '../types/UserRewards';
import { RewardUser } from './RewardUser';

export class EvaaUserRewards implements Contract {
    readonly address: Address;
    constructor(readonly config: EvaaUserRewardsConfig) {
        this.address = config.userAddress;
    }

    private openUserContract(provider: ContractProvider) {
        return provider.open(RewardUser.createFromConfig(this.config));
    }

    async sendDeployAndClaim(provider: ContractProvider, via: Sender, signedClaim: string, claimBody: string) {
        const claimCell = beginCell()
            .storeUint(2, 32)
            .storeUint(0, 64)
            .storeBuffer(Buffer.from(signedClaim, 'base64'))
            .storeRef(Cell.fromBase64(claimBody))
            .endCell();

        const dataCell = RewardUser.rewardUserConfigToCell(this.config);
        const stateInit = beginCell().storeRef(this.config.rewardUserCode).storeRef(dataCell).endCell();

        const combinedCell = beginCell().storeRef(stateInit).storeRef(claimCell).endCell();
        await this.openUserContract(provider).sendClaim(via, combinedCell);
    }
}
