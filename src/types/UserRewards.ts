import { Address, Cell } from '@ton/ton';
import { PoolAssetConfig } from './Master';

export type EvaaUserRewardsConfig = {
    userAddress: Address;
    rewardUserCode: Cell;
    rewardMasterAddress: Address;
    asset: PoolAssetConfig;
    publicKey: Buffer;
};
