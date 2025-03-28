import { Address, Cell } from '@ton/ton';
import { PoolAssetConfig } from './Master';

export type EvaaRewardsConfig = {
    workchain?: number;
    adminAddress: Address;
    evaaMasterAddress: Address;
    availableReward: number;
    asset: PoolAssetConfig;
    rewardMasterCode: Cell;
    rewardUserCode: Cell;
    publicKey: Buffer;
};
