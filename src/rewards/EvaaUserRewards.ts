import { Address, beginCell, Cell, Contract, ContractProvider, OpenedContract, Sender } from '@ton/core';
import { RewardUser } from './RewardUser';

export type EvaaUserRewardsConfig = {
    userAddress: Address;
    rewardUserCode: Cell;
    baseTrackingAccrued: number;
    rewardMasterAddress: Address;
    assetId: Buffer;
    publicKey: Buffer;
};

export class EvaaUserRewards implements Contract {
    readonly address: Address;
    constructor(readonly config: EvaaUserRewardsConfig) {
        this.address = config.userAddress;
    }

    openUserContract(provider: ContractProvider): OpenedContract<RewardUser> {
        return provider.open(RewardUser.createFromConfig(this.config, this.config.rewardUserCode));
    }

    async sendDeployAndClaim(provider: ContractProvider, via: Sender, signedClaim: Buffer, claimBody: Cell) {
        const claimCell = beginCell()
            .storeUint(2, 32)
            .storeUint(0, 64)
            .storeBuffer(signedClaim)
            .storeRef(claimBody)
            .endCell();

        try {
            await this.openUserContract(provider).getData();
            await this.openUserContract(provider).sendClaim(via, claimCell);
        } catch (error) {
            console.error(error);

            const dataCell = RewardUser.rewardUserConfigToCell(this.config);
            const stateInit = beginCell().storeRef(this.config.rewardUserCode).storeRef(dataCell).endCell();

            const combinedCell = beginCell().storeRef(stateInit).storeRef(claimCell).endCell();
            await this.openUserContract(provider).sendClaim(via, combinedCell);
        }
    }
}
