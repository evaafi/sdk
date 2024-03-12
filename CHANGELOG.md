# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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