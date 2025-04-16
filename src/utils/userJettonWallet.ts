import { Address, beginCell, Cell, storeStateInit } from '@ton/core';
import { PoolAssetConfig } from '../types/Master';
import { UNDEFINED_ASSET } from '../constants/assets';

function getUserJettonData(ownerAddress: Address, assetName: string, jettonWalletCode: Cell, jettonMasterAddress: Address) {
  switch (assetName) {
      case 'uTON':
          return beginCell()
              .storeCoins(0)
              .storeUint(0, 64)
              .storeAddress(ownerAddress)
              .storeAddress(jettonMasterAddress)
              .storeRef(jettonWalletCode)
              .endCell();
      case 'DOGS':
      case 'NOT':
      case 'USDT':
          return beginCell()
              .storeUint(0, 4)
              .storeCoins(0)
              .storeAddress(ownerAddress)
              .storeAddress(jettonMasterAddress)
              .endCell();
      case 'tsTON':
          return beginCell()
              .storeCoins(0)
              .storeAddress(ownerAddress)
              .storeAddress(jettonMasterAddress)
              .storeRef(jettonWalletCode)
              .storeCoins(0)
              .storeUint(0, 48)
              .endCell();
      case 'tgBTC':
          return beginCell()
              .storeUint(0, 4)
              .storeCoins(0)
              .storeAddress(ownerAddress)
              .storeAddress(jettonMasterAddress)
              .endCell();
      default:
          return beginCell().storeCoins(0)
              .storeAddress(ownerAddress)
              .storeAddress(jettonMasterAddress)
              .storeRef(jettonWalletCode)
              .endCell();
  }
}
export function getUserJettonWallet(ownerAddress: Address, poolAssetConfig: PoolAssetConfig) {
  const assetName = poolAssetConfig.name;
  if (assetName == 'TON' || poolAssetConfig.assetId === UNDEFINED_ASSET.assetId) {
    throw new Error(`Cant getUserJettonWallet for ${poolAssetConfig.name} asset`)
  }
  let jettonWalletCode = poolAssetConfig.jettonWalletCode;

  if (assetName === 'USDT' || assetName === 'tsTON') {
    const lib_prep = beginCell().storeUint(2, 8).storeBuffer(jettonWalletCode.hash()).endCell();
    jettonWalletCode = new Cell({ exotic: true, bits: lib_prep.bits, refs: lib_prep.refs });
  }

  const jettonData = getUserJettonData(ownerAddress, assetName, jettonWalletCode, poolAssetConfig.jettonMasterAddress);

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
