import { Address, beginCell, Cell, storeStateInit } from '@ton/core';
import { PoolAssetConfig } from '../types/Master';
import { UNDEFINED_ASSET } from '../constants/assets';

export function getUserJettonWallet(ownerAddress: Address, poolAssetConfig: PoolAssetConfig) {
  if (poolAssetConfig.name == 'TON' || poolAssetConfig.assetId === UNDEFINED_ASSET.assetId) {
    throw new Error(`Cant getUserJettonWallet for ${poolAssetConfig.name} asset`)
  }
    const jettonMasterAddress = poolAssetConfig.jettonMasterAddress;
    const jettonWalletCode = poolAssetConfig.jettonWalletCode;

  if (poolAssetConfig.name === 'USDT') {
    const lib_prep = beginCell().storeUint(2, 8).storeBuffer(jettonWalletCode.hash()).endCell();
    const jwallet_code = new Cell({ exotic: true, bits: lib_prep.bits, refs: lib_prep.refs });

    const jettonData = beginCell()
      .storeUint(0, 4)
      .storeCoins(0)
      .storeAddress(ownerAddress)
      .storeAddress(jettonMasterAddress)
      .endCell();

    const stateInit = beginCell()
      .store(
        storeStateInit({
          code: jwallet_code,
          data: jettonData
        })
      )
      .endCell();
    return new Address(0, stateInit.hash());
  }

  if (poolAssetConfig.name === 'tsTON') {
    const lib_prep = beginCell().storeUint(2, 8).storeBuffer(jettonWalletCode.hash()).endCell();
    const jwallet_code = new Cell({ exotic: true, bits: lib_prep.bits, refs: lib_prep.refs });

    const jettonData = beginCell()
      .storeCoins(0)
      .storeAddress(ownerAddress)
      .storeAddress(jettonMasterAddress)
      .storeRef(jwallet_code)
      .storeCoins(0)
      .storeUint(0, 48)
      .endCell();

    const stateInit = beginCell()
      .store(
        storeStateInit({
          code: jwallet_code,
          data: jettonData
        })
      )
      .endCell();

    return new Address(0, stateInit.hash());
  }

  const jettonData = beginCell()
    .storeCoins(0)
    .storeAddress(ownerAddress)
    .storeAddress(jettonMasterAddress)
    .storeRef(jettonWalletCode)
    .endCell();

  const stateInit = beginCell()
    .store(
      storeStateInit({
        code: jettonWalletCode,
        data: jettonData
      })
    )
    .endCell();

  return new Address(0, stateInit.hash());
}
