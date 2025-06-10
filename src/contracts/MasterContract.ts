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
    toNano,
} from '@ton/core';
import {
    FEES,
    OPCODES,
} from '../constants/general';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { EvaaUser } from './UserContract';
import { parseMasterData } from '../api/parser';
import { MasterData, PoolAssetConfig, PoolConfig } from '../types/Master';
import { JettonWallet } from './JettonWallet';
import { getUserJettonWallet } from '../utils/userJettonWallet';
import { isTonAsset, isTonAssetId, MAINNET_POOL_CONFIG } from '..';
import {HexString} from "@pythnetwork/hermes-client";
import {
    composeFeedsCell,
    DEFAULT_HERMES_ENDPOINT,
    getPythFeedsUpdates,
    packPythUpdatesData
} from "../api/prices"

import {makeOnchainGetterMasterMessage, makePythProxyMessage} from "../api/pyth";

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
    returnRepayRemainingsFlag: boolean;
    customPayloadRecipient: Address;
    customPayloadSaturationFlag: boolean;
};

/**
 * pyth specific parameters
 */
export type PythBaseData = {
    priceData: Buffer | Cell
    targetFeeds: HexString[];
};

export type ProxySpecificPythParams = {
    pythAddress: Address;
    attachedValue: bigint;
    minPublishTime: number | bigint;
    maxPublishTime: number | bigint;
};

export type OnchainSpecificPythParams = {
    publishGap: number | bigint;
    maxStaleness: number | bigint;
}

export type JettonPythParams = PythBaseData & OnchainSpecificPythParams;

export type TonPythParams = PythBaseData & ProxySpecificPythParams;

/**
 * Parameters for the withdraw message
 * @property queryID - unique query ID
 * @property asset - asset config
 * @property amount - amount to withdraw
 * @property userAddress - user address
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type WithdrawParametersBase = {
    queryID: bigint;
    amount: bigint;
    userAddress: Address;
    includeUserCode: boolean;
    asset: PoolAssetConfig
    amountToTransfer: bigint;
    payload: Cell;
    subaccountId?: number;
    customPayloadSaturationFlag: boolean;
}

/**
 * Parameters for the withdraw message
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type WithdrawParameters = WithdrawParametersBase & {
    priceData: Cell;
};

export type PythWithdrawParameters = WithdrawParametersBase & {
    pyth: TonPythParams;
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
    customPayloadSaturationFlag: boolean;
};

/**
 * Base parameters for liquidation
 * @property queryID - unique query ID
 * @property liquidatorAddress - liquidator address, where and collateral will be sent
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property pyth - pyth related params.
 * @property payload - liquidation operation custom payload
 * @property payloadForwardAmount - amount of coins to forward with payload
 */
export type LiquidationParameters = LiquidationBaseData & {
    asset: PoolAssetConfig;
    queryID: bigint;
    liquidatorAddress: Address;
    responseAddress: Address;
    includeUserCode: boolean;
    pyth: PythBaseData & (ProxySpecificPythParams | OnchainSpecificPythParams);
    payload: Cell;
};

export type SupplyWithdrawParameters = {
    queryID: bigint;
    supplyAmount: bigint;
    supplyAsset: PoolAssetConfig;
    withdrawAmount: bigint;
    withdrawAsset: PoolAssetConfig;
    withdrawRecipient: Address;
    includeUserCode: boolean;
    tonForRepayRemainings: bigint;
    payload: Cell;
    subaccountId: number;
    returnRepayRemainingsFlag: boolean;
    customPayloadSaturationFlag: boolean;
    pyth?: PythBaseData & (ProxySpecificPythParams | OnchainSpecificPythParams);
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

    get pythData() {
        const data = this._data;
        if (!data) return null;
        return data!.masterConfig.oraclesInfo;
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
     * Create withdraw message
     * @returns withdraw message as a cell
     */
    createPythWithdrawMessage(parameters: PythWithdrawParameters): Cell {

        const extraDataTail = ((parameters.subaccountId ?? 0) == 0) ?
            beginCell().endCell() :
            beginCell().storeInt(parameters.subaccountId ?? 0, 16)
                .storeUint(0, 2) // custom_payload_saturation_flag = false (default)
                .endCell();

        const {
            priceData, targetFeeds,
            minPublishTime, maxPublishTime
        } = parameters.pyth as TonPythParams;

        const wrappedOperationPayload =
            beginCell()
            .storeUint(OPCODES.WITHDRAW, 32)
            .storeUint(parameters.queryID, 64)
            .storeRef(
                beginCell().storeUint(parameters.asset.assetId, 256)
                    .storeUint(parameters.amount, 64)
                    .storeAddress(parameters.userAddress)
                    .storeInt(parameters.includeUserCode ? -1 : 0, 2)
                    .storeUint(parameters.amountToTransfer, 64)
                    .storeRef(parameters.payload)
                    .storeSlice(extraDataTail.beginParse())
                    .endCell()
            )
            .endCell();

        // pyth message will be sent to pyth for prices validation and then payload will be sent to evaa master
        return makePythProxyMessage(
            this.address, // master contract address
            packPythUpdatesData(priceData), composeFeedsCell(targetFeeds), minPublishTime, maxPublishTime,
            wrappedOperationPayload
        );
    }

    /**
     * Create withdraw no prices message
     * @returns withdraw message as a cell
     */
    createWithdrawMessage(parameters: WithdrawParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;
        const subaccount = beginCell().storeInt(subaccountId, 16);
        return beginCell()
            .storeUint(OPCODES.WITHDRAW, 32)
            .storeUint(parameters.queryID, 64)
            .storeUint(parameters.asset.assetId, 256)
            .storeUint(parameters.amount, 64)
            .storeAddress(parameters.userAddress)
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeUint(parameters.amountToTransfer, 64)
            .storeRef(parameters.payload)
            .storeRef(parameters.priceData)
            .storeBuilder(subaccount)
            .storeUint(parameters.customPayloadSaturationFlag ? -1 : 0, 2)
            .endCell();
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
            .endCell();

        if (!isTon) {
            // JETTON

            const {
                priceData, targetFeeds,
                publishGap, maxStaleness
            } = parameters.pyth as JettonPythParams;

            // operationPayload contains liquidation operation info to be parsed in operation processor method

            // this message master contract receives on
            const masterMessage = makeOnchainGetterMasterMessage({
                queryId: parameters.queryID,
                opCode: OPCODES.LIQUIDATE,
                updateDataCell: packPythUpdatesData(priceData),
                targetFeedsCell: composeFeedsCell(targetFeeds),
                publishGap,
                maxStaleness,
                operationPayload,
            });

            // jetton transfer message
            return this.createJettonTransferMessage(parameters, FEES.LIQUIDATION_JETTON_FWD, masterMessage);
        } else {
            // TON

            const {
                priceData, targetFeeds,
                minPublishTime, maxPublishTime
            } = parameters.pyth as TonPythParams;

            const wrappedOperationPayload = beginCell()
                .storeUint(OPCODES.LIQUIDATE, 32)
                .storeUint(parameters.queryID, 64)
                .storeRef(operationPayload) // real operation payload, which will be parsed in ton liquidate method
                .endCell();

            // pyth message will be sent to pyth for prices validation and then payload will be sent to evaa master
            return makePythProxyMessage(
                this.address, // master contract address
                packPythUpdatesData(priceData), composeFeedsCell(targetFeeds), minPublishTime, maxPublishTime,
                wrappedOperationPayload
            );
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
            .storeUint(parameters.tonForRepayRemainings, 64)
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

        return parameters.pyth === undefined ?
            this.createSupplyWithdrawMessageNoPrices(parameters, operationPayload) :
            this.createPythSupplyWithdrawMessage(parameters, operationPayload);
    }

    protected createPythSupplyWithdrawMessage(parameters: SupplyWithdrawParameters, operationPayload: Cell): Cell {
        if (!isTonAsset(parameters.supplyAsset)) {
            // JETTON

            const {
                priceData, targetFeeds,
                publishGap, maxStaleness
            } = parameters.pyth as JettonPythParams;

            // operationPayload contains liquidation operation info to be parsed in operation processor method

            // this message master contract receives on
            const masterMessage = makeOnchainGetterMasterMessage({
                queryId: parameters.queryID,
                opCode: OPCODES.SUPPLY_WITHDRAW_JETTON,
                updateDataCell: packPythUpdatesData(priceData),
                targetFeedsCell: composeFeedsCell(targetFeeds),
                publishGap,
                maxStaleness,
                operationPayload,
            });

            // jetton transfer message
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW_JETTON_FWD, masterMessage);
        } else {
            // TON

            const {
                priceData, targetFeeds,
                minPublishTime, maxPublishTime
            } = parameters.pyth as TonPythParams;

            const wrappedOperationPayload = beginCell()
                .storeUint(OPCODES.SUPPLY_WITHDRAW, 32)
                .storeUint(parameters.queryID, 64)
                .storeRef(operationPayload) // real operation payload, which will be parsed in ton liquidate method
                .endCell();

            // pyth message will be sent to pyth for prices validation and then payload will be sent to evaa master
            return makePythProxyMessage(
                this.address, // master contract address
                packPythUpdatesData(priceData), composeFeedsCell(targetFeeds), minPublishTime, maxPublishTime,
                wrappedOperationPayload
            );
        }

    }

    protected createSupplyWithdrawMessageNoPrices(parameters: SupplyWithdrawParameters, operationPayload: Cell): Cell {
        if (!isTonAsset(parameters.supplyAsset)) {
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW_JETTON_FWD,
                beginCell().storeUint(OPCODES.SUPPLY_WITHDRAW_NO_PRICES, 32)
                    .storeSlice(operationPayload.beginParse()).endCell()
            );
        } else {
            return beginCell()
                .storeUint(OPCODES.SUPPLY_WITHDRAW_NO_PRICES, 32)
                .storeUint(parameters.queryID, 64)
                .storeSlice(operationPayload.beginParse())
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

    // no prices left for merge to make it clear
    async sendWithdraw(provider: ContractProvider, via: Sender, value: bigint, parameters: WithdrawParameters) {
        const message = this.createWithdrawMessage(parameters);

        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: message,
        });
    }

    async sendWithdrawPyth(provider: ContractProvider, via: Sender, value: bigint, parameters: PythWithdrawParameters) {
        const _parameters = {...parameters}; // make a copy
        _parameters.pyth = {...parameters.pyth, ...{attachedValue: value}};
        const message = this.createPythWithdrawMessage(_parameters);
        // console.log('message: ', message);

        await via.send({
            value: value,
            to: _parameters.pyth.pythAddress,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: message,
        });
    }

    async sendLiquidation(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: LiquidationParameters,
    ) {
        const _parameters = {...parameters}; // make a copy
        _parameters.pyth = {...parameters.pyth, ...{attachedValue: value}};
        const message = this.createLiquidationMessage(_parameters);

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

    // @ts-ignore
    /**
     * Fetches pyth price updates from specified endpoint
     * @param provider
     * @param targetFeeds
     * @param endpoint
     */
    async getPrices(provider: ContractProvider, targetFeeds: HexString[], endpoint?: string) {
        return getPythFeedsUpdates(targetFeeds, endpoint ?? DEFAULT_HERMES_ENDPOINT);
    }
}
