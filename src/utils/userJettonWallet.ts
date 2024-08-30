import { Address, beginCell, Cell, storeStateInit } from '@ton/core';
import { PoolJettonAssetConfig } from '../types/Master';

export function getUserJettonWallet(ownerAddress: Address, poolAssetConfig: PoolJettonAssetConfig): Address {
    const builder = beginCell().storeCoins(0).storeAddress(ownerAddress);
    let jettonWalletCode: Cell;
    builder.storeAddress(poolAssetConfig.jettonMasterAddress);
    jettonWalletCode = poolAssetConfig.jettonWalletCode;
    const data = builder.storeRef(jettonWalletCode).endCell();
    const stateInit = beginCell()
        .store(
            storeStateInit({
                code: jettonWalletCode,
                data: data,
            }),
        )
        .endCell();
    return new Address(0, stateInit.hash());
}
