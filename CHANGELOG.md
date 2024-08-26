# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## 0.5.3 - 2024-08-20

### Fixed
- getPrices now supports several endpoints (works on the principle of which one will answer faster, whose answer is used) and throws an exception if prices are not loaded

## 0.5.2 - 2024-08-19

### Fixed
- predictHealthFactor argument processing improving
- getSync fixed parsing contract state, base64url was replaced to base64 encoding which has much higher support

## 0.5.1 - 2024-07-05

### Added
- predictHealthFactor function to predict a change in a health factor after repay, borrow, supply, withdraw

## 0.5.0 - 2024-06-29
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

## 0.4.0 - 2024-06-01
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

## 0.3.2 - 2024-04-20
### Added
- New asset - Tether USD

## 0.3.1 - 2024-04-19
### Added
- New asset - tsTON

## 0.3.0 - 2024-04-04
### Added
- New asset - stTON

### Changed
- Price fetching from another source
- Testnet master contract address
- Master contracts' version

### Removed
- Ethereum dependencies

## 0.2.0 - 2024-03-13
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

## 0.1.0 - 2024-03-11
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
