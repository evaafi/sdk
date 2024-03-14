# Extended Documentation

In this part of the documentation you will find a more detailed explanation of some parts of the SDK.

## PriceData

When we use the `getPrices` function, we get an object containing two fields:

- dict: A dictionary in which the key is the asset ID and the value is the price.
- dataCell: A cell with signed prices, which is only used to pass to the contract for processing.

The price dictionary is widely used within the SDK to calculate various values for the user. It is also convenient to get the price of any asset from here.

## Master Data

Master data contains the following fields:

- meta: Some metadata about the master contract
- upgradeConfig:

| Field | Description                                                                                |
| --- |--------------------------------------------------------------------------------------------|
| masterCodeVersion | The current version of the master contract                                                 |
| userCodeVersion | The current version of the user contract                                                   |
| timeout | Number of seconds from the current time after which the contract will be updated           |
| updateTime | Time after which the contract will be upgraded. <br/>`updateTime = now() + timeout`        |
| freezeTime | Contract freeze time                                                                |
| userCode | The current code of the user contract                                                      |
| blankCode | The blank code of the user contract. Used to calculate the address of the user contract |
| newMasterCode | The new code of the master contract                                                        |
| newUserCode | The new code of the user contract                                                          |

- assetsConfig: 

| Field | Description                                                                                                         |
| --- |---------------------------------------------------------------------------------------------------------------------|
| oracle | Deprecated                                                                                                          |
| decimals | Number of decimal places for the asset.                                                                          |
| collateralFactor | Limit coefficient (power as collateral)                                                                             |
| liquidationThreshold | Limit coefficient (power as collateral) for liquidation                                                             |
| liquidationBonus | Liquidator's reward                                                                                                 |
| baseBorrowRate | Minimum daily borrowing rate                                                                                        |
| borrowRateSlopeLow | Coefficient of dependence of the per second borrowing rate on utilization, if the utilization is lower than optimal |
| borrowRateSlopeHigh | Coefficient of dependence of the per second borrowing rate on utilization, if utilization is higher than optimal    |
| supplyRateSlopeLow | Coefficient of dependence of per second deposit rate on utilization, if utilization is lower than optimal           |
| supplyRateSlopeHigh | Coefficient of dependence of per second deposit rate on utilization if utilization is higher than optimal           |
| targetUtilization | Utilization threshold exceeding which results in surge in rates                                                     |
| originationFee | Percentage of loan charged for origination of loan at its origination                                                                                                                  |

- assetsData:

| Field | Description                                                   |
| --- |---------------------------------------------------------------|
| sRate and bRate | Explanation of these fields is given in the User Data section |
| totalSupply | The total supply principal                                    |
| totalBorrow | The total borrow principal                                    |
| lastAccural | The last time the data (sRate and bRate) was updated          |
| balance | The balance of the master contract for the asset              |
| supplyInterest | Per-second rate for supply                                    |
| borrowInterest | Per-second rate for borrow |

- masterConfig: Contains the configuration of the master contract
- apy: The annual interest rate the user receives for depositing assets or paying to borrow them
- assetsReserves: The protocol's own reserves

**Note**: More detailed information about the fields can be found in the [EVAA Protocol documentation](https://evaa.gitbook.io/intro/details-of-protocol/)

## User Data

When working with the user, it is necessary to understand what each field means:

| Field | Description                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- |------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| principals | Internal currency of the protocol. These are the values that only change with interacting directly with the balance: supply, withdraw, liquidation. <br/><br/> Based on them, the user's real token balance is calculated: <br/> `assetBalance = principal * sRate`, if principal > 0 <br/> `assetBalance = principal * bRate`, if principal < 0 <br/><br/> sRate and bBate increase over time due to rate accrual |
| state | When withdrawing funds, for security reasons, the user's contract is blocked for the duration of the operation. This field is responsible for this state                                                                                                                                                                                                                                                         |
| balances | The real current (can change every second) token balance of the user with the type specified: supply or borrow                                                                                                                                                                                                                                                                                                   |
| withdrawalLimits | Only assets that are in the "Supply" category will be listed here, so they can be withdrawn                                                                                                                                                                                                                                                                                                             |
| borrowLimits | Only assets that are in the "Borrow" category will be listed here so that more can be borrowed                                                                                                                                                                                                                                                                                                    |
| repayLimits | Only assets that are in the "Borrow" category will be listed here so that they can be repaid                                                                                                                                                                                                                                                                                                                   |
| supplyBalance | The sum of all assets in dollars that the user has deposited in the protocol                                                                                                                                                                                                                                                                                                                                     |
| borrowBalance | The sum of all assets in dollars that the user has borrowed                                                                                                                                                                                                                                                                                                                                                      |
| availableToBorrow | The sum in dollars that the user can borrow                                                                                                                                                                                                                                                                                                                                                                      |
| limitUsedPercent | The percentage of the debt limit that the user has already used                                                                                                                                                                                                                                                                                                                                                  |
| healthFactor | The health factor of the user account. If it is less than 0, the account is in danger of liquidation                                                                                                                                                                                                                                                                                                               |

**Note**: Currently, fields `trackingSupplyIndex`, `trackingBorrowIndex`, `dutchAuctionStart` and `backupCell` are not used in contracts.