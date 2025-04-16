# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## 0.6.3 &mdash; 2025-04-01
### Added
 - ```EvaaRewards``` wrapper of RewardUser contract with ```PoolAssetConfig```
 - ```RewardUser``` wrapper of reward user contract
 - ```RewardMaster``` wrapper of reward master contract
 - ```JettonMinget``` wrapper of jetton master contract
 - ```JettonWallet``` wrapper of jetton wallet contract
 - ```EVAA_REWARDS_MASTER_CODE_MAINNET``` and ```EVAA_REWARDS_MASTER_CODE_TESTNET``` is constants for reward master code
 - ```EVAA_REWARDS_USER_CODE_TESTNET``` and ```EVAA_REWARDS_USER_CODE_MAINNET``` is constants for reward user code
 - ```TESTNET_MASTER_REWARD_CONFIG``` testnet TON config of reward 
 - ```TESTNET_MASTER_EUSDT_REWARD_CONFIG``` testnet EUSDT config of reward
 - ```MAINNET_MASTER_TON_REWARD_CONFIG``` mainnet TON config of reward
 - ```MAINNET_MASTER_USDT_REWARD_CONFIG``` mainnet USDT config of reward

## 0.6.2-c &mdash; 2025-01-07
### Added
 - ```getAssetLiquidityMinusReserves``` function needed to count the amount of free amount for withdrawal
### Fixed
 - ```borrowLimits``` function now take into account the amount available for withdrawal

## 0.6.2-b &mdash; 2024-12-17
### Added
 - new field in ```UserLiteData``` . ```fullyParsed``` and ```havePrincipalWithoutPrice```
   true if all prices for user parsing were provided or true if have a principal without price 
   now user.getSync and parseUserData can work without some prices
 - ```predictAPY``` - function that predicts a change in apy after supply or withdraw 

## 0.6.2-a &mdash; 2024-12-13
### Added
 - new field in UserLiteData ```user.data.realPrincipals``` -
   principals before applying dusts
### Fixed
 - getPricesForWithdraw/getPricesForLiquidate they should now be called with a different argument 

## 0.6.2 &mdash; 2024-11-21
### Added
- ALTS Pool
- PricesCollector class  
  - Supports multiple prices sources [iota nft, evaa backend, internetcomputer (icp) http backend] (sources can be configured)
  - Updates prices only when needed, prices may expire no earlier than a minute later
  - Ability to cut prices and resign it and send only the necessary ones in order to reduce fee
    - ```typescript
      async getPricesForWithdraw(userPrincipals: Dictionary<bigint, bigint>, withdrawAsset: PoolAssetConfig, collateralToDebt = false, ....) 
      ```
      collateralToDebt param responsible for the fact that supply can go to borrow (there is no such case at the front end)
    - ```typescript
      async getPricesForLiquidate(userPrincipals: Dictionary<bigint, bigint> ...)
      ```
  - Price Signature Vrification
  - Minimal Oracles Number Verification
  - Independent and parallel loading of prices (now the fastest but invalid response won't break anything)
  - Support for partial number of assets from price sources
  - Updated examples in docs/examples
  - PricesCollector test coverage
  - If the price is missing (for example, for security reasons), then there will be no error, it will simply NOT be added to the result dict

### Changed
- getPrices is deprecated use PricesCollector instead

## 0.6.1-a &mdash; 2024-10-29
### Changed
- updated `EVAA_LP_MAINNET_VERSION` to `3`
- `awaitedSupply` is always defined
### Fixed
- `applyDust` is `false` by default in `parseUserLiteData` and `parseUserData`
- `minimalOracles` is `3` in all pools


## 0.6.1 &mdash; 2024-10-22
### Changed
- added liquidation.ts with ```findAssetById```, ```calculateAssetsValues```, ```selectGreatestAssets```, ```calculateMinCollateralByTransferredAmount```, ```calculateLiquidationAmounts```, ```isLiquidatable```, ```isBadDebt```, ```addReserve```, ```deductReserve```, ```toAssetAmount```, ```toAssetWorth```, ```addLiquidationBonus```, ```deductLiquidationBonus```, ```PreparedAssetInfo```, ```prepareAssetInfo``` functions required or flexible liquidations calculation.
- user. ```getSync``` and ```getSyncLite``` new argument ```applyDust``` by default is ```false```;
- updated sdk usage example
### Fixed


## 0.6.0a &mdash; 2024-10-14
### Changed
- user. ```getSync``` and ```getSyncLite``` new argument ```applyDust``` by default is ```false```
### Fixed
- Healthfactor calculation minor bug
- createLiquidationMessage fix new field payloadForwardAmount

## 0.6.0 &mdash; 2024-10-10
### Added
- SDK Supports Evaa v6 smart contracts
### Fixed
- Updated documentation and examples for v6 interactions
- User Withdrawal and Borrow limits
## 0.5.6a - 2024-10-09
### Fixed
- Fix typo in ```calculateMaximumWithdrawAmount```

## 0.5.6 &mdash; 2024-09-28

### Added
- ```isTonAsset(PoolAssetConfig)``` function 
### Fixed
Dust is a small amount of principal that is ignored
- ```parseUserLiteData``` (dust) & ```parseUserData``` (dust and withdrawLimits) calculations problem
- ```user.data.withdrawalLimits```, ```user.data.balance```, ```user.data.principals``` calculation for LP pool contract and main pool contract
### Changed 
- ```parseUserLiteData``` (without prices), ```parseUserData``` applyDust argument default value changed to ```True```
- Many composite types were removed from sdk  
  -  ```PoolTonAssetConfig, PoolJettonAssetConfig``` -> ```PoolAssetConfig```,
  -  ```JettonMessageParameters, SupplyBaseParameters, TonSupplyParameters, JettonSupplyParameters``` -> ```SupplyParameters```,
  -  ```LiquidationBasePrameters, TonLiquidationParameters, JettonLiquidationParameters``` -> ```LiquidationParameters```

## 0.5.5

### Added
- calculateMaximumWithdrawAmount function 
### Fixed
- parseUserLiteData (dust) & parseUserData (dust and withdrawLimits) calculations problem

## 0.5.4 &mdash; 2024-09-09

check ```tests\supply_withdraw_test.ts``` for new examples

### Added 

- Pools supports (new argument for Evaa master contract) + LP_POOL constants, default is MAINNET_POOL_CONFIG, default pool is MAINNET_POOL_CONFIG
```typescript
const evaa = client.open(new Evaa({poolConfig: TESTNET_LP_POOL_CONFIG}));

const evaaMainNet = clientMainNet.open(new Evaa({poolConfig: MAINNET_LP_POOL_CONFIG}));
```
- New types for pools initializtion, for assets
check ```constants\assets.ts``` for new examples

- getPrices - a new function inside Evaa, returns prices of current pool

```typescript
await evaaMainNet.getPrices()
```
### Changed 
- New argument nftId (depends on pool) for getPrices 
```typescript
export async function getPrices(endpoints: string[] = ["api.stardust-mainnet.iotaledger.net"], nftId: string = MAIN_POOL_NFT_ID) {
```

- Everything about working with assets, new assets list
```typescript
import { JUSDC_MAINNET, JUSDC_TESTNET, JUSDT_MAINNET, JUSDT_TESTNET, STTON_MAINNET, STTON_TESTNET, TON_MAINNET, TON_STORM_MAINNET, TONUSDT_DEDUST_MAINNET, TSTON_MAINNET, USDT_MAINNET, USDT_STORM_MAINNET } from "@evaafi/sdk";
```

```typescript
await evaaMainNet.sendSupply(sender_mainnet, toNano(1), {
    queryID: 0n,
    includeUserCode: true,
    amount: 500_000_000n,
    userAddress: address_mainnet,
    asset: TON_MAINNET
});
```
### Fixed
- predictHealthFactor minor fixes
- getUserJettonWallet all currencies support

## 0.5.3 &mdash; 2024-08-20

### Fixed
- getPrices now supports several endpoints (works on the principle of which one will answer faster, whose answer is used) and throws an exception if prices are not loaded

## 0.5.2 &mdash; 2024-08-19

### Fixed
- predictHealthFactor argument processing improving
- getSync fixed parsing contract state, base64url was replaced to base64 encoding which has much higher support

## 0.5.1 &mdash; 2024-07-05

### Added
- predictHealthFactor function to predict a change in a health factor after repay, borrow, supply, withdraw

## 0.5.0 &mdash; 2024-06-29
This release contains breaking changes.  

### Added
- Reserve variables parsing on user & master sc
- Added endpoint argument for getPrices, default api.stardust-mainnet.iotaledger.net
- Added applyDust (default false) option in parseUserLiteData and parseUserData

### Changed
- Master contracts' version
- Testnet master contract address
- Parsers on master sc 
- Parsers on user sc 
- Liquidation calculations now counts with reserve factor from master config 

### Fixed
- UserBalance calculation was fixed

## 0.4.0 &mdash; 2024-06-01
This release contains breaking changes.

### Added
- Master storage onchain getter
- User storage onchain getter
- Testnet flag for `parseMasterData`, `parseUserData` and `parseUserLiteData` functions
- `maxTotalSupply` field to Assets Config
- Seperate Assets ID for Mainnet and Testnet

### Changed
- Master contracts' version
- Testnet master contract address

### Removed
- `ASSET_ID` constant

### Fixed
- Jetton wallets address calculation
- Field names in Assets Config and Assets Data serialization functions

## 0.3.2 &mdash; 2024-04-20
### Added
- New asset - Tether USD

## 0.3.1 &mdash; 2024-04-19
### Added
- New asset - tsTON

## 0.3.0 &mdash; 2024-04-04
### Added
- New asset - stTON

### Changed
- Price fetching from another source
- Testnet master contract address
- Master contracts' version

### Removed
- Ethereum dependencies

## 0.2.0 &mdash; 2024-03-13
This release contains breaking changes.

### Added
- BOC of last sent message via TonConnect. Can be obtained by `getLastSentBoc` function
- Calculation of user's health factor

### Changed
- Testnet master contract address and version
- Supply fee from 0.5 TON to 0.3 TON
- APY moved from user data to master data

### Removed
- Description of some methods in `UserContract` and `MasterContract`

### Fixed
- Calculation of borrow limits

## 0.1.0 &mdash; 2024-03-11
### Added
- Parsing user lite data, which does not require prices
- Assets reserves to `MasterData`
- Types and methods descriptions in `MasterContract` and `UserContract`

### Changed
- Added parallel price fetching
- Crypto library to 'crypto-js' for compatibility with browser
- Testnet Master version to 2

### Removed
- `sort-deep-object-arrays` dependency

### Fixed
- Getting user's jetton wallet
