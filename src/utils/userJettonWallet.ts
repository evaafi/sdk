import { Address, beginCell, storeStateInit } from '@ton/core';
import { ASSET_ID, JETTON_MASTER_ADDRESSES, JETTON_WALLET_CODE } from '../constants';

export function getUserJettonWallet(ownerAddress: Address, assetID: bigint, network: 'mainnet' | 'testnet'): Address {
    const builder = beginCell().storeCoins(0).storeAddress(ownerAddress);
    switch (assetID) {
        case ASSET_ID.jUSDT:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDT_MAINNET);
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDT_TESTNET);
            }
            break;
        case ASSET_ID.jUSDC:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDC_MAINNET);
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDC_TESTNET);
            }
            break;
        case ASSET_ID.stTON:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.stTON_MAINNET);
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.stTON_TESTNET);
            }
            break;
        case ASSET_ID.tsTON:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.tsTON_MAINNET);
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.tsTON_TESTNET);
            }
            break;
        case ASSET_ID.USDT:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.USDT_MAINNET);
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.USDT_TESTNET);
            }
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
