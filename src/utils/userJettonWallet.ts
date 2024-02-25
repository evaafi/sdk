import { Address, beginCell, storeStateInit } from '@ton/core';
import { ASSET_ID, JETTON_MASTER_ADDRESSES, JETTON_WALLET_CODE } from '../constants';

export function getUserJettonWallet(ownerAddress: Address, assetID: bigint, network: 'mainnet' | 'testnet'): Address {
    const builder = beginCell().storeCoins(0).storeAddress(ownerAddress);
    switch (assetID) {
        case ASSET_ID.jUSDT:
            builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDT_TESTNET);
            break;
        case ASSET_ID.jUSDC:
            builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDC_TESTNET);
            break;
        default:
            throw new Error('Unsupported asset');
    }
    const data = builder.storeRef(JETTON_WALLET_CODE).endCell();
    const stateInit = beginCell()
        .store(
            storeStateInit({
                code: JETTON_WALLET_CODE,
                data: data,
            }),
        )
        .endCell();
    return new Address(0, stateInit.hash());
}
