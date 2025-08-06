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
      case 'USDe':
          return beginCell()
              .storeUint(0, 4)
              .storeCoins(0)
              .storeAddress(ownerAddress)
              .storeAddress(jettonMasterAddress)
              .endCell();
      case 'tsUSDe':
        return beginCell()
          .storeUint(0, 4)
          .storeCoins(0)
          .storeAddress(ownerAddress)
          .storeAddress(jettonMasterAddress)
          .storeCoins(0)
          .storeUint(0, 64)
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

  if (assetName === 'tgBTC') {
    const SHARD_DEPTH = 8;
    const MY_WORKCHAIN = 0;
    const shardPrefix = beginCell().storeAddress(ownerAddress).endCell().beginParse().skip(3 + 8).preloadUint(SHARD_DEPTH);
    
    const stateInit = beginCell()
       .storeUint(1, 1)
       .storeUint(SHARD_DEPTH, 5) // No split_depth; No special
       .storeUint(0, 1)
       .storeMaybeRef(jettonWalletCode)
       .storeMaybeRef(jettonData)
       .storeUint(0, 1) // Empty libraries
       .endCell();
    
    const cellHash = BigInt("0x" + stateInit.hash().toString('hex'));

    const mask = (1n << BigInt(256 - SHARD_DEPTH)) - 1n;
    const prefixLess = cellHash & mask;

    const resultAddr = beginCell()
      .storeUint(4, 3)                      // addr_std$10, 3 бита
      .storeInt(MY_WORKCHAIN, 8)            // workchain_id, 8 бит
      .storeUint(shardPrefix, SHARD_DEPTH)  // shard_prefix
      .storeUint(prefixLess, 256 - SHARD_DEPTH) // остаток от init хэша
      .endCell().beginParse().loadAddress();
    
    return resultAddr;

  } else {
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
}
