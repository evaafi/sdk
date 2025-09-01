import { HexString } from '@pythnetwork/hermes-client';
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
import { Maybe } from '@ton/core/dist/utils/maybe';
import { isTonAsset, isTonAssetId, isValidSubaccountId } from '..';
import { parseMasterData } from '../api/parser';
import { OracleParser } from '../api/parsers/AbstractOracleParser';
import { FEES, OPCODES } from '../constants/general';
import { MasterData, PoolAssetConfig, PoolConfig } from '../types/Master';
import { getUserJettonWallet } from '../utils/userJettonWallet';
import { ClassicSupplyWithdrawParameters } from './ClassicMaster';
import { JettonWallet } from './JettonWallet';
import { PythSupplyWithdrawParameters } from './PythMaster';
import { EvaaUser } from './UserContract';

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
};

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
    asset: PoolAssetConfig;
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
 * pyth specific parameters
 */
export type PythBaseData = {
    priceData: Buffer | Cell;
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
};

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
export type WithdrawParameters = {
    queryID: bigint;
    amount: bigint;
    userAddress: Address;
    includeUserCode: boolean;
    asset: PoolAssetConfig;
    priceData: Cell;
    payload: Cell;
    subaccountId?: number;
    forwardAmount?: bigint;
    amountToTransfer: bigint;
    customPayloadSaturationFlag: boolean;
    returnRepayRemainingsFlag: boolean;
};

/**
 * Parameters for the withdraw message
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type ClassicWithdrawParameters = WithdrawParameters & {
    priceData: Cell;
};

export type PythWithdrawParameters = WithdrawParameters & {
    pyth: TonPythParams;
};

/**
 * Base data for liquidation. Can be obtained from the user contract liquidationParameters getter
 * @property borrowerAddress - borrower address (user address that is being liquidated)
 * @property loanAsset - loan asset ID
 * @property collateralAsset - collateral asset ID
 * @property minCollateralAmount - minimal amount to receive from the liquidation
 * @property liquidationAmount - amount to liquidate
 * @property asset - asset config
 * @property queryID - unique query ID
 * @property liquidatorAddress - liquidator address, where and collateral will be sent
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property payload - liquidation operation custom payload
 * @property payloadForwardAmount - amount of coins to forward with payload
 */
export type LiquidationBaseData = {
    borrowerAddress: Address;
    loanAsset: bigint;
    collateralAsset: bigint;
    minCollateralAmount: bigint;
    liquidationAmount: bigint;
    asset: PoolAssetConfig;
    queryID: bigint;
    payload: Cell;
    // TODO: maybe deprecate it, and use responseAddress instead of
    liquidatorAddress: Address;
    includeUserCode: boolean;
    subaccountId?: number;
    customPayloadRecipient?: Address;
    customPayloadSaturationFlag?: boolean;
};

export type PythLiquidationParameters = LiquidationBaseData & {
    pyth: PythBaseData & (ProxySpecificPythParams | OnchainSpecificPythParams);
};

export type LiquidationParameters = LiquidationBaseData & {
    priceData: Cell;
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
    forwardAmount?: bigint;
    responseAddress?: Address;
};

/**
 * Abstract EVAA Master base that encapsulates shared logic and structure.
 * Concrete implementations (Classic/Pyth) should override message creation for
 * withdraw/liquidation and supply-withdraw wrapping.
 */
export abstract class AbstractEvaaMaster implements Contract {
    readonly address: Address;
    protected _poolConfig: PoolConfig;
    protected readonly debug?: boolean;
    protected _data?: MasterData;
    protected lastSync = 0;

    constructor(parameters: EvaaParameters) {
        this._poolConfig = parameters.poolConfig;
        this.address = this._poolConfig.masterAddress;
        this.debug = parameters?.debug;
    }

    get poolConfig(): PoolConfig {
        return this._poolConfig;
    }

    get data(): Maybe<MasterData> {
        return this._data;
    }

    // ---------- Common helpers ----------
    protected createJettonTransferMessage(parameters: JettonParams, defaultFees: bigint, message: Cell): Cell {
        if (
            parameters.amount == undefined &&
            parameters.liquidationAmount == undefined &&
            parameters.supplyAmount == undefined
        ) {
            throw new Error('Either amount or liquidationAmount or supplyAmount must be provided');
        }
        return beginCell()
            .storeUint(OPCODES.JETTON_TRANSFER, 32)
            .storeUint(parameters.queryID, 64)
            .storeCoins(parameters.amount ?? parameters.liquidationAmount ?? parameters.supplyAmount ?? 0n)
            .storeAddress(parameters.destinationAddress ?? this.address)
            .storeAddress(parameters.responseAddress ?? parameters.userAddress ?? parameters.liquidatorAddress)
            .storeBit(0)
            .storeCoins(parameters.forwardAmount ?? defaultFees)
            .storeBit(1)
            .storeRef(message)
            .endCell();
    }

    abstract buildGeneralDataPayload(parameters: PythSupplyWithdrawParameters | ClassicSupplyWithdrawParameters): Cell;

    protected buildSupplyWithdrawOperationPayload(
        parameters: PythSupplyWithdrawParameters | ClassicSupplyWithdrawParameters,
    ): Cell {
        const isTon = isTonAsset(parameters.supplyAsset);

        const supplyData = beginCell();
        if (isTon) {
            supplyData.storeUint(parameters.supplyAmount, 64);
        }

        const withdrawData = beginCell()
            .storeUint(parameters.withdrawAmount, 64)
            .storeUint(parameters.withdrawAsset.assetId, 256)
            .storeAddress(parameters.withdrawRecipient);

        const generalData = this.buildGeneralDataPayload(parameters);
        return beginCell().storeRef(supplyData).storeRef(withdrawData).storeRef(generalData).endCell();
    }

    // ---------- Public message builders (shared) ----------
    createSupplyMessage(parameters: SupplyParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;
        const isTon = isTonAsset(parameters.asset);

        const operationPayload = beginCell()
            .storeUint(OPCODES.SUPPLY_MASTER, 32)
            .storeBuilder(isTon ? beginCell().storeUint(parameters.queryID, 64) : beginCell())
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeBuilder(isTon ? beginCell().storeUint(parameters.amount, 64) : beginCell())
            .storeAddress(parameters.userAddress)
            .storeRef(parameters.payload)
            .storeInt(subaccountId, 16)
            .storeInt(parameters.returnRepayRemainingsFlag ? -1 : 0, 2)
            .storeAddress(parameters.customPayloadRecipient)
            .storeInt(parameters.customPayloadSaturationFlag ? -1 : 0, 2)
            .endCell();

        if (!isTon) {
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_JETTON_FWD, operationPayload);
        } else {
            return operationPayload;
        }
    }

    // Concrete classes must wrap the operation payload correctly for their oracle
    abstract createSupplyWithdrawMessage(parameters: SupplyWithdrawParameters): Cell;

    // ---------- Sending operations ----------
    async sendSupply(provider: ContractProvider, via: Sender, value: bigint, parameters: SupplyParameters) {
        const message = this.createSupplyMessage(parameters);

        if (!isTonAsset(parameters.asset)) {
            if (!via.address) throw new Error('Via address is required for jetton supply');
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

    async sendSupplyWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: ClassicSupplyWithdrawParameters,
    ) {
        const message = this.createSupplyWithdrawMessage(parameters);

        if (!isTonAssetId(parameters.supplyAsset.assetId)) {
            if (!via.address) throw new Error('Via address is required for jetton supply-withdraw');
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

    // Abstract where oracle path differs
    abstract sendWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: WithdrawParameters | PythWithdrawParameters,
    ): Promise<void>;

    protected abstract createLiquidationMessage(parameters: LiquidationParameters | PythLiquidationParameters): Cell;

    abstract sendLiquidation(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: LiquidationParameters | PythLiquidationParameters,
    ): Promise<void>;

    // ---------- Read helpers ----------
    calculateUserSCAddr(userAddress: Address, lendingCode: Cell, subaccountId: number = 0): Address {
        const subaccount = beginCell();
        if (subaccountId != 0) {
            if (!isValidSubaccountId(subaccountId)) throw new Error('Invalid subaccount id');
            subaccount.storeInt(subaccountId, 16);
        }

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

    openUserContract(userAddress: Address, subaccountId: number = 0): EvaaUser {
        return EvaaUser.createFromAddress(
            this.calculateUserSCAddr(userAddress, this._poolConfig.lendingCode, subaccountId),
            this._poolConfig,
        );
    }

    getOpenedUserContract(
        provider: ContractProvider,
        userAddress: Address,
        subaccountId: number = 0,
    ): OpenedContract<EvaaUser> {
        return provider.open(this.openUserContract(userAddress, subaccountId));
    }

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

    // Centralized sync logic used by concrete masters (Classic/Pyth)
    protected async syncMasterData(provider: ContractProvider, oracleParser: OracleParser): Promise<void> {
        const state = (await provider.getState()).state;
        if (state.type === 'active') {
            this._data = parseMasterData(
                state.data!.toString('base64'),
                this._poolConfig.poolAssetsConfig,
                this._poolConfig.masterConstants,
                oracleParser,
            );
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

    protected abstract getSync(provider: ContractProvider): Promise<void>;
}
