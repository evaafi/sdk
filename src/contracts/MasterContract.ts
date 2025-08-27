import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractProvider,
    OpenedContract,
    Sender,
    SendMode,
    storeStateInit,
} from '@ton/core';
import { FEES, OPCODES, } from '../constants/general';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { EvaaUser } from './UserContract';
import { parseMasterData } from '../api/parser';
import { MasterData, PoolAssetConfig, PoolConfig } from '../types/Master';
import { JettonWallet } from './JettonWallet';
import { getUserJettonWallet } from '../utils/userJettonWallet';
import {
    DefaultPriceSourcesConfig,
    getPrices,
    isTonAsset,
    isTonAssetId,
    MAINNET_POOL_CONFIG,
    PricesCollector,
    PriceSourcesConfig,
    TON_MAINNET
} from '..';

/**
 * Parameters for the Evaa contract
 * @property testnet - true for testnet, false for mainnet
 * @property debug - true to enable debug mode (optional)
 */
export type EvaaParameters = {
    poolConfig: PoolConfig;
    debug?: boolean;
};

/**
 * Base parameters for supply
 * @property queryID - unique query ID
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property amount - amount to supply
 * @property userAddress - user address
 * @property asset
 */
export type SupplyParameters = {
    asset: PoolAssetConfig
    queryID: bigint;
    includeUserCode: boolean;
    amount: bigint;
    userAddress: Address;
    responseAddress?: Address;
    forwardAmount?: bigint;
    payload: Cell;
    subaccountId?: number;
    returnRepayRemainingsFlag?: boolean;
    customPayloadRecipient?: Address;
    customPayloadSaturationFlag?: boolean;
};

/**
 * Parameters for the withdraw message
 * @property queryID - unique query ID
 *  * @property assetID - asset ID
 * @property assetID - asset ID
 * @property amount - amount to withdraw
 * @property userAddress - user address
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type WithdrawParameters = {
    queryID: bigint;
    amount: bigint;
    userAddress: Address;
    includeUserCode: boolean;
    asset: PoolAssetConfig
    priceData: Cell;
    payload: Cell;
    subaccountId?: number;
    forwardAmount?: bigint;
};

/**
 * Base data for liquidation. Can be obtained from the user contract liquidationParameters getter
 * @property borrowerAddress - borrower address (user address that is being liquidated)
 * @property loanAsset - loan asset ID
 * @property collateralAsset - collateral asset ID
 * @property minCollateralAmount - minimal amount to receive from the liquidation
 * @property liquidationAmount - amount to liquidate
 * @property tonLiquidation - true if the loan asset is TON
 */
export type LiquidationBaseData = {
    borrowerAddress: Address;
    loanAsset: bigint;
    collateralAsset: bigint;
    minCollateralAmount: bigint;
    liquidationAmount: bigint;
    tonLiquidation: boolean;
    forwardAmount?: bigint;
    subaccountId?: number;
    customPayloadRecipient?: Address;
    customPayloadSaturationFlag?: boolean;
};

/**
 * Base parameters for liquidation
 * @property queryID - unique query ID
 * @property liquidatorAddress - liquidator address, where and collateral will be sent
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type LiquidationParameters = LiquidationBaseData & {
    asset: PoolAssetConfig;
    queryID: bigint;
    liquidatorAddress: Address;
    responseAddress: Address;
    includeUserCode: boolean;
    priceData: Cell;
    payload: Cell;
    payloadForwardAmount: bigint;
};

export type SupplyWithdrawParameters = {
    queryID: bigint;
    supplyAmount: bigint;
    supplyAsset: PoolAssetConfig;
    withdrawAmount: bigint;
    withdrawAsset: PoolAssetConfig;
    withdrawRecipient: Address;
    includeUserCode: boolean;
    tonForRepayRemainings?: bigint;
    payload: Cell;
    subaccountId?: number;
    returnRepayRemainingsFlag?: boolean;
    customPayloadSaturationFlag?: boolean;
    priceData?: Cell;
    forwardAmount?: bigint;
    responseAddress?: Address;
}

// Internal
type JettonParams = {
    queryID: bigint;
    amount?: bigint;
    liquidationAmount?: bigint;
    supplyAmount?: bigint;
    responseAddress?: Address;
    userAddress?: Address;
    liquidatorAddress?: Address;
    forwardAmount?: bigint;
    destinationAddress?: Address;
}

/**
 * Evaa master contract wrapper
 */
export class Evaa implements Contract {
    readonly address: Address;
    private _poolConfig: PoolConfig;
    private readonly debug?: boolean;
    private _data?: MasterData;
    private lastSync = 0;

    /**
     * Create Evaa contract wrapper
     * @param parameters Evaa contract parameters
     */
    constructor(parameters?: EvaaParameters) {
        this._poolConfig = parameters?.poolConfig ?? MAINNET_POOL_CONFIG;
        this.address = this._poolConfig.masterAddress;
        this.debug = parameters?.debug;
    }

    /**
     * Returns pool config
     */
    get poolConfig(): PoolConfig {
        return this._poolConfig;
    }

    protected createJettonTransferMessage(parameters: JettonParams, defaultFees: bigint, message: Cell): Cell {
        if (parameters.amount == undefined && parameters.liquidationAmount == undefined && parameters.supplyAmount == undefined) {
            throw new Error('Either amount or liquidationAmount or supplyAmount must be provided')
        }
        return beginCell()
            .storeUint(OPCODES.JETTON_TRANSFER, 32)
            .storeUint(parameters.queryID, 64)
            .storeCoins(parameters.amount ?? parameters.liquidationAmount ?? parameters.supplyAmount ?? 0n)
            .storeAddress(parameters.destinationAddress ?? this.address) // notify master
            .storeAddress(parameters.responseAddress ?? parameters.userAddress ?? parameters.liquidatorAddress)
            .storeBit(0)
            .storeCoins(parameters.forwardAmount ?? defaultFees)
            .storeBit(1)
            .storeRef(message)
            .endCell();
    }

    /**
     * Create supply message
     * @returns supply message as a cell
     */
    createSupplyMessage(parameters: SupplyParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;

        const isTon = isTonAsset(parameters.asset);

        const operationPayload = beginCell()
            .storeUint(OPCODES.SUPPLY, 32)
            .storeBuilder(isTon ? beginCell().storeUint(parameters.queryID, 64) : beginCell())
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeBuilder(isTon ? beginCell().storeUint(parameters.amount, 64) : beginCell())
            .storeAddress(parameters.userAddress)
            .storeRef(parameters.payload)
            .storeInt(subaccountId, 16)
            .storeInt(parameters.returnRepayRemainingsFlag ? -1 : 0, 2)
            .storeAddress(parameters.customPayloadRecipient)
            .storeUint(parameters.customPayloadSaturationFlag ? -1 : 0, 2)
            .endCell();

        if (!isTon) {
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_JETTON_FWD, operationPayload);
        } else {
            return operationPayload;
        }
    }

    /**
     * Create supply-withdraw message
     * @returns supply-withdraw message as a cell
     */
    createSupplyWithdrawMessage(parameters: SupplyWithdrawParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;

        const isTon = isTonAsset(parameters.supplyAsset);

        const supplyData = beginCell();
        if (isTon) {
            supplyData.storeUint(parameters.supplyAmount, 64);
        }

        const withdrawData = beginCell()
            .storeUint(parameters.withdrawAmount, 64)
            .storeUint(parameters.withdrawAsset.assetId, 256)
            .storeAddress(parameters.withdrawRecipient);

        const generalData = beginCell()
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeMaybeRef(parameters.priceData) // to match the main pool message structure
            .storeUint(parameters.tonForRepayRemainings ?? 0n, 64)
            .storeRef(parameters.payload);

        if ((subaccountId != 0) || parameters.returnRepayRemainingsFlag || parameters.customPayloadSaturationFlag) {
            generalData.storeInt(subaccountId, 16);
            generalData.storeInt(parameters.returnRepayRemainingsFlag ? -1 : 0, 2);
            generalData.storeInt(parameters.customPayloadSaturationFlag ? -1 : 0, 2);
        }

        const operationPayload = beginCell()
            .storeRef(supplyData)
            .storeRef(withdrawData)
            .storeRef(generalData)
            .endCell();

        let op = OPCODES.SUPPLY_WITHDRAW;
        if (!parameters.priceData) {
            op = OPCODES.SUPPLY_WITHDRAW_WITHOUT_PRICES;
        }

        if (!isTonAsset(parameters.supplyAsset)) {
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW_JETTON_FWD,
                beginCell().storeUint(op, 32)
                    .storeSlice(operationPayload.beginParse()).endCell()
            );
        } else {
            return beginCell()
                .storeUint(op, 32)
                .storeUint(parameters.queryID, 64)
                .storeSlice(operationPayload.beginParse())
                .endCell();
        }
    }

    /**
     * Create liquidation message
     * @returns liquidation message as a cell
     */
    createLiquidationMessage(parameters: LiquidationParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;

        const isTon = isTonAsset(parameters.asset);

        const innerCell = beginCell()
            .storeRef(parameters.payload);

        if ((subaccountId != 0) || parameters.customPayloadRecipient || parameters.customPayloadSaturationFlag) {
            innerCell.storeInt(subaccountId, 16);
            innerCell.storeAddress(parameters.customPayloadRecipient);
            innerCell.storeUint(parameters.customPayloadSaturationFlag ? -1 : 0, 2);
        }

        const operationPayload = beginCell()
            .storeAddress(parameters.borrowerAddress)
            // .storeAddress(parameters.liquidatorAddress)
            .storeUint(parameters.collateralAsset, 256)
            .storeUint(parameters.minCollateralAmount, 64)
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeUint(isTon ? parameters.liquidationAmount : 0, 64)
            // do not need liquidationAmount in case of jetton liquidation because
            // the exact amount of transferred jettons for liquidation is known
            .storeRef(innerCell)
            .storeRef(parameters.priceData);

        if (!isTonAsset(parameters.asset)) {
            return this.createJettonTransferMessage(parameters, FEES.LIQUIDATION_JETTON_FWD,
                beginCell()
                    .storeUint(OPCODES.LIQUIDATE, 32)
                    .storeBuilder(operationPayload)
                    .endCell()
            );
        } else {
            return beginCell()
                .storeUint(OPCODES.LIQUIDATE, 32)
                .storeUint(parameters.queryID, 64)
                .storeBuilder(operationPayload)
                .endCell();
        }
    }

    /**
     * Calculate user contract address
     * @param userAddress
     * @param lendingCode
     * @param subaccountId
     * @returns user contract address
     */
    calculateUserSCAddr(userAddress: Address, lendingCode: Cell, subaccountId: number = 0): Address {
        const subaccount = subaccountId != 0 ? beginCell().storeInt(subaccountId, 16) : beginCell();

        const lendingData = beginCell()
            .storeAddress(this.address)
            .storeAddress(userAddress)
            .storeUint(0, 8)
            .storeBit(0)
            .storeBuilder(subaccount)
            .endCell();

        const stateInit = beginCell()
            .store(
                storeStateInit({
                    code: lendingCode,
                    data: lendingData,
                }),
            )
            .endCell();
        return new Address(0, stateInit.hash());
    }

    /**
     * Open user contract wrapper
     * @param userAddress
     * @param subaccountId
     * @returns user contract
     */
    openUserContract(userAddress: Address, subaccountId: number = 0): EvaaUser {
        return EvaaUser.createFromAddress(this.calculateUserSCAddr(userAddress, this._poolConfig.lendingCode, subaccountId), this._poolConfig);
    }

    getOpenedUserContract(provider: ContractProvider, userAddress: Address, subaccountId: number = 0): OpenedContract<EvaaUser> {
        return provider.open(this.openUserContract(userAddress, subaccountId));
    }

    /**
     * Get master contract data
     */
    get data(): Maybe<MasterData> {
        return this._data;
    }

    async sendSupply(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: SupplyParameters,
    ) {
        const message = this.createSupplyMessage(parameters);

        if (!isTonAsset(parameters.asset)) {
            if (!via.address) {
                throw Error('Via address is required for jetton supply');
            }

            const jettonWallet = provider.open(
                JettonWallet.createFromAddress(getUserJettonWallet(via.address, parameters.asset)),
            );
            await jettonWallet.sendTransfer(via, value, message);
        } else {
            await provider.internal(via, {
                value,
                sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
                body: message,
            });
        }
    }

    // compatibility layer - emulate withdraw with supplyWithdraw
    async sendWithdraw(provider: ContractProvider, via: Sender, value: bigint, parameters: WithdrawParameters) {
        return this.sendSupplyWithdraw(provider, via, value, {
            supplyAsset: TON_MAINNET,
            supplyAmount: 0n,
            queryID: parameters.queryID,
            withdrawAsset: parameters.asset,
            withdrawAmount: parameters.amount,
            withdrawRecipient: parameters.userAddress,
            includeUserCode: parameters.includeUserCode,
            forwardAmount: parameters.forwardAmount,
            payload: parameters.payload,
            subaccountId: parameters.subaccountId ?? 0,
            customPayloadSaturationFlag: false,
            returnRepayRemainingsFlag: false,
            tonForRepayRemainings: 0n,
            priceData: parameters.priceData,
        });
    }

    async sendSupplyWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: SupplyWithdrawParameters,
    ) {
        const message = this.createSupplyWithdrawMessage(parameters);

        if (!isTonAssetId(parameters.supplyAsset.assetId)) {
            if (!via.address) {
                throw Error('Via address is required for jetton supply-withdraw');
            }

            const jettonWallet = provider.open(
                JettonWallet.createFromAddress(getUserJettonWallet(via.address, parameters.supplyAsset)),
            );
            await jettonWallet.sendTransfer(via, value, message);
        } else {
            await provider.internal(via, {
                value,
                sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
                body: message,
            });
        }
    }

    async sendLiquidation(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: LiquidationParameters,
    ) {
        const message = this.createLiquidationMessage(parameters);

        if (!isTonAssetId(parameters.loanAsset)) {
            if (!via.address) {
                throw Error('Via address is required for jetton liquidation');
            }
            
            const jettonWallet = provider.open(
                JettonWallet.createFromAddress(getUserJettonWallet(via.address, parameters.asset)),
            );
            await jettonWallet.sendTransfer(via, value, message);
        } else {
            await provider.internal(via, {
                value,
                sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
                body: message,
            });
        }
    }

    /**
     * Open user contract wrapper
     * @param forwardPayload - payload that will be forwarded to the address which requested the data
     */
    async sendOnchainGetter(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        forwardPayload: Cell,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: beginCell()
                .storeUint(OPCODES.ONCHAIN_GETTER, 32)
                .storeUint(queryID, 64)
                .storeRef(forwardPayload)
                .endCell(),
        });
    }

    /**
     * Sync master contract data
     */
    async getSync(provider: ContractProvider) {
        const state = (await provider.getState()).state;
        if (state.type === 'active') {
            this._data = parseMasterData(state.data!.toString('base64'), this._poolConfig.poolAssetsConfig, this._poolConfig.masterConstants);
            if (this._data.upgradeConfig.masterCodeVersion !== this._poolConfig.masterVersion) {
                throw Error(
                    `Outdated SDK pool version. It supports only master code version ${this._poolConfig.masterVersion}, but the current master code version is ${this._data.upgradeConfig.masterCodeVersion}`,
                );
            }
            this.lastSync = Math.floor(Date.now() / 1000);
        } else {
            throw Error('Master contract is not active');
        }
    }

    /**
     * @deprecated Use PriceCollector (createPriceCollector) istead of getPrices
     */
    async getPrices(provider: ContractProvider, endpoints?: string[]) {
        if ((endpoints?.length ?? 0) > 0) {
            return await getPrices(endpoints, this._poolConfig);
        } else {
            return await getPrices(undefined, this._poolConfig);
        }
    }

    createPriceCollector(priceSourcesConfig: PriceSourcesConfig = DefaultPriceSourcesConfig) : PricesCollector {
        return new PricesCollector(this._poolConfig, priceSourcesConfig);
    }
}
