# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## 0.1.0 - 2024-11-03
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
