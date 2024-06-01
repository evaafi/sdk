import { Address, beginCell, Cell, storeStateInit } from '@ton/core';
import { JETTON_MASTER_ADDRESSES, JETTON_WALLETS_CODE, MAINNET_ASSETS_ID } from '../constants';

export function getUserJettonWallet(ownerAddress: Address, assetID: bigint, network: 'mainnet' | 'testnet'): Address {
    const builder = beginCell().storeCoins(0).storeAddress(ownerAddress);
    let jettonWalletCode: Cell;
    switch (assetID) {
        case MAINNET_ASSETS_ID.jUSDT:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDT_MAINNET);
                jettonWalletCode = JETTON_WALLETS_CODE.jUSDT_MAINNET;
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDT_TESTNET);
                jettonWalletCode = JETTON_WALLETS_CODE.jUSDT_TESTNET;
            }
            break;
        case MAINNET_ASSETS_ID.jUSDC:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDC_MAINNET);
                jettonWalletCode = JETTON_WALLETS_CODE.jUSDC_MAINNET;
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.jUSDC_TESTNET);
                jettonWalletCode = JETTON_WALLETS_CODE.jUSDC_TESTNET;
            }
            break;
        case MAINNET_ASSETS_ID.stTON:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.stTON_MAINNET);
                jettonWalletCode = JETTON_WALLETS_CODE.stTON_MAINNET;
            } else {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.stTON_TESTNET);
                jettonWalletCode = JETTON_WALLETS_CODE.stTON_TESTNET;
            }
            break;
        case MAINNET_ASSETS_ID.tsTON:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.tsTON_MAINNET);
                jettonWalletCode = JETTON_WALLETS_CODE.tsTON_MAINNET;
            } else {
                // builder.storeAddress(JETTON_MASTER_ADDRESSES.tsTON_TESTNET);
                // jettonWalletCode = JETTON_WALLETS_CODE.tsTON_TESTNET;
                throw new Error('tsTON is not supported on testnet');
            }
            break;
        case MAINNET_ASSETS_ID.USDT:
            if (network === 'mainnet') {
                builder.storeAddress(JETTON_MASTER_ADDRESSES.USDT_MAINNET);
                jettonWalletCode = JETTON_WALLETS_CODE.USDT_MAINNET;
            } else {
                // builder.storeAddress(JETTON_MASTER_ADDRESSES.USDT_TESTNET);
                // jettonWalletCode = JETTON_WALLETS_CODE.USDT_TESTNET;
                throw new Error('USDT is not supported on testnet');
            }
            break;
        default:
            throw new Error('Unsupported asset');
    }
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
