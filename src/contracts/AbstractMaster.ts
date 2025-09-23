import {
    Address,
    beginCell,
    Builder,
    Cell,
    Contract,
    ContractProvider,
    Dictionary,
    OpenedContract,
    Sender,
    SendMode,
    storeStateInit,
} from '@ton/core';
import { isTonAsset, isValidSubaccountId } from '..';
import { parseMasterData } from '../api/parser';
import { OracleParser } from '../api/parsers/AbstractOracleParser';
import { ClassicOracleInfo } from '../api/parsers/ClassicOracleParser';
import { PythOracleInfo } from '../api/parsers/PythOracleParser';
import { FEES, OPCODES, VALIDATION } from '../constants/general';
import { ExtendedAssetsConfig, ExtendedAssetsData, PoolAssetConfig, PoolConfig, UpgradeConfig } from '../types/Master';
import { getUserJettonWallet } from '../utils/userJettonWallet';
import {
    ClassicLiquidationOperationParameters,
    ClassicLiquidationParameters,
    ClassicSupplyWithdrawParameters,
    ClassicWithdrawParameters,
} from './ClassicMaster';
import { JettonWallet } from './JettonWallet';
import {
    PythLiquidationOperationParameters,
    PythLiquidationParameters,
    PythSupplyWithdrawParameters,
    PythWithdrawParameters,
} from './PythMaster';
import { EvaaUser } from './UserContract';

// Internal
export interface JettonParams {
    readonly queryID: bigint;
    readonly amount?: bigint;
    readonly liquidationAmount?: bigint;
    readonly supplyAmount?: bigint;
    readonly responseAddress?: Address;
    readonly userAddress?: Address;
    readonly liquidatorAddress?: Address;
    readonly forwardAmount?: bigint;
    readonly destinationAddress?: Address;
}

type RequireAtLeastOne<T, K extends keyof T> = T & { [P in K]: Required<T>[P] }[K];
export type ValidJettonParams = RequireAtLeastOne<JettonParams, 'amount' | 'liquidationAmount' | 'supplyAmount'>;

/**
 * Parameters for initializing an Evaa contract instance
 * @interface EvaaParameters
 */
export interface EvaaParameters {
    /** Pool configuration containing contract addresses and settings */
    readonly poolConfig: PoolConfig;
    /** Optional debug mode flag for development purposes */
    readonly debug?: boolean;
}

/**
 * Parameters for supply operations
 * @interface SupplyParameters
 */
export interface SupplyParameters {
    /** Asset configuration for the supply operation */
    readonly asset: PoolAssetConfig;
    /** Unique identifier for this operation */
    readonly queryID: bigint;
    /** Whether to include user contract code update */
    readonly includeUserCode: boolean;
    /** Amount to supply (must be positive) */
    readonly amount: bigint;
    /** Address of the user performing the supply */
    readonly userAddress: Address;
    /** Optional address for operation response */
    readonly responseAddress?: Address;
    /** Optional forward amount for transaction fees */
    readonly forwardAmount?: bigint;
    /** Operation payload cell */
    readonly payload: Cell;
    /** Optional subaccount identifier (0-255) */
    readonly subaccountId?: number;
    /** Whether to return repay remainings */
    readonly returnRepayRemainingsFlag?: boolean;
    /** Optional custom payload recipient address */
    readonly customPayloadRecipient?: Address;
    /** Whether to saturate custom payload */
    readonly customPayloadSaturationFlag?: boolean;
}

/**
 * Parameters for withdraw operations
 * @interface WithdrawParameters
 */
export interface WithdrawParameters {
    /** Unique identifier for this operation */
    readonly queryID: bigint;
    /** Amount to withdraw (must be positive) */
    readonly amount: bigint;
    /** Address of the user performing the withdrawal */
    readonly userAddress: Address;
    /** Whether to include user contract code update */
    readonly includeUserCode: boolean;
    /** Asset configuration for the withdrawal */
    readonly asset: PoolAssetConfig;
    /** Operation payload cell */
    readonly payload: Cell;
    /** Optional subaccount identifier (0-255) */
    readonly subaccountId?: number;
    /** Optional forward amount for transaction fees */
    readonly forwardAmount?: bigint;
    /** Actual amount to transfer after calculations */
    readonly amountToTransfer: bigint;
    /** Whether to saturate custom payload */
    readonly customPayloadSaturationFlag: boolean;
    /** Whether to return repay remainings */
    readonly returnRepayRemainingsFlag: boolean;
}

/**
 * Parameters for liquidation inner operations
 * @interface LiquidationInnerParameters
 */
export interface LiquidationInnerParameters {
    /** Liquidation operation payload cell */
    readonly payload: Cell;
    /** Subaccount identifier for the operation */
    readonly subaccountId: number;
    /** Address to receive custom payload */
    readonly customPayloadRecipient: Address;
    /** Whether to saturate the custom payload */
    readonly customPayloadSaturationFlag: boolean;
}

/**
 * Base parameters for liquidation operations
 * @interface LiquidationParameters
 * @description Can be obtained from the user contract liquidationParameters getter
 */
export interface LiquidationParameters {
    /** Asset ID of the loan being liquidated */
    readonly loanAsset: bigint;
    /** Unique identifier for this operation */
    readonly queryID: bigint;
    /** Address where collateral will be sent upon liquidation */
    readonly liquidatorAddress: Address;
}

/**
 * Parameters for building liquidation operations
 * @interface LiquidationOperationBuilderParameters
 */
export interface LiquidationOperationBuilderParameters {
    /** Asset configuration for the liquidation */
    readonly asset: PoolAssetConfig;
    /** Address of the borrower being liquidated */
    readonly borrowerAddress: Address;
    /** Asset ID of the collateral to be seized */
    readonly collateralAsset: bigint;
    /** Minimum collateral amount expected from liquidation */
    readonly minCollateralAmount: bigint;
    /** Amount of debt to liquidate */
    readonly liquidationAmount: bigint;
    /** Whether to include user contract code update */
    readonly includeUserCode: boolean;
}

export interface SupplyWithdrawParameters {
    readonly queryID: bigint;
    readonly supplyAmount: bigint;
    readonly supplyAsset: PoolAssetConfig;
    readonly withdrawAmount: bigint;
    readonly withdrawAsset: PoolAssetConfig;
    readonly withdrawRecipient: Address;
    readonly includeUserCode: boolean;
    readonly tonForRepayRemainings?: bigint;
    readonly payload: Cell;
    readonly subaccountId?: number;
    readonly returnRepayRemainingsFlag?: boolean;
    readonly customPayloadSaturationFlag?: boolean;
    readonly forwardAmount?: bigint;
    readonly responseAddress?: Address;
}

// Base shared configuration for all master types
export interface BaseMasterConfig {
    readonly ifActive: number;
    readonly admin: Address;
    readonly tokenKeys: Cell | null;
    readonly supervisor: Address | null;
}

export type OracleInfo = PythOracleInfo | ClassicOracleInfo;

// Generic master configuration with oracle info
export interface MasterConfig<T extends OracleInfo> extends BaseMasterConfig {
    readonly oraclesInfo: T;
}

// Base shared data for all master types
export interface BaseMasterData {
    readonly meta: string;
    readonly upgradeConfig: UpgradeConfig;
    readonly assetsConfig: ExtendedAssetsConfig;
    readonly assetsData: ExtendedAssetsData;
    readonly assetsReserves: Dictionary<bigint, bigint>;
    readonly apy: {
        readonly supply: Dictionary<bigint, number>;
        readonly borrow: Dictionary<bigint, number>;
    };
}

// Generic master data with config
export interface MasterData<T extends MasterConfig<OracleInfo>> extends BaseMasterData {
    readonly masterConfig: T;
}

/**
 * Abstract base class for EVAA Master contracts
 *
 * This class provides shared functionality for both Classic and Pyth master implementations,
 * including message creation, validation, and transaction handling. Concrete implementations
 * must override oracle-specific methods for withdraw/liquidation operations.
 *
 * @template T - Master data type extending MasterData with specific oracle configuration
 * @abstract
 * @implements {Contract}
 */
export abstract class AbstractEvaaMaster<T extends MasterData<MasterConfig<OracleInfo>>> implements Contract {
    readonly address: Address;
    protected _poolConfig: PoolConfig;
    protected readonly debug?: boolean;
    protected _data?: T;
    protected lastSync = 0;

    /**
     * Initialize the abstract master contract
     * @param parameters - Configuration parameters for the Evaa master
     */
    constructor(parameters: EvaaParameters) {
        this._poolConfig = parameters.poolConfig;
        this.address = this._poolConfig.masterAddress;
        this.debug = parameters?.debug;
    }

    /**
     * Get the current pool configuration
     * @returns {PoolConfig} The pool configuration object
     */
    get poolConfig(): PoolConfig {
        return this._poolConfig;
    }

    /**
     * Get the synchronized master data
     * @returns {T | undefined} Master data if available, undefined otherwise
     */
    get data(): T | undefined {
        return this._data;
    }

    // ========== VALIDATION METHODS ==========
    /**
     * Validates jetton parameters ensuring at least one amount field is provided
     * @private
     * @static
     * @param parameters - Jetton parameters to validate
     * @returns {ValidJettonParams} Validated parameters
     * @throws {Error} When no amount fields are provided
     */
    private static validateJettonParams(parameters: JettonParams): ValidJettonParams {
        if (
            parameters.amount == undefined &&
            parameters.liquidationAmount == undefined &&
            parameters.supplyAmount == undefined
        ) {
            throw new Error(`JettonParams validation failed: ${VALIDATION.ERRORS.MISSING_JETTON_AMOUNT}`);
        }
        return parameters as ValidJettonParams;
    }

    /**
     * Creates a jetton transfer message with the provided parameters
     * @protected
     * @param parameters - Jetton transfer parameters
     * @param defaultFees - Default fee amount for the operation
     * @param message - Operation message cell to include
     * @returns {Cell} Complete jetton transfer message cell
     * @throws {Error} When validation fails or required addresses are missing
     */
    protected createJettonTransferMessage(parameters: JettonParams, defaultFees: bigint, message: Cell): Cell {
        const validParams = AbstractEvaaMaster.validateJettonParams(parameters);
        const amount = validParams.amount ?? validParams.liquidationAmount ?? validParams.supplyAmount ?? 0n;
        const responseAddress = validParams.responseAddress ?? validParams.userAddress ?? validParams.liquidatorAddress;

        if (!responseAddress) {
            throw new Error(`JettonTransfer validation failed: ${VALIDATION.ERRORS.MISSING_RESPONSE_ADDRESS}`);
        }

        return beginCell()
            .storeUint(OPCODES.JETTON_TRANSFER, 32)
            .storeUint(validParams.queryID, 64)
            .storeCoins(amount)
            .storeAddress(validParams.destinationAddress ?? this.address)
            .storeAddress(responseAddress)
            .storeBit(0)
            .storeCoins(validParams.forwardAmount ?? defaultFees)
            .storeBit(1)
            .storeRef(message)
            .endCell();
    }

    /**
     * Builds general data payload for supply-withdraw operations
     * @abstract
     * @param parameters - Supply-withdraw parameters (oracle-specific)
     * @returns {Cell} General data payload cell
     */
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

    // ========== MESSAGE BUILDERS ==========
    /**
     * Validates supply operation parameters
     * @private
     * @static
     * @param parameters - Supply parameters to validate
     * @throws {Error} When amount is invalid or subaccount ID is out of range
     */
    private static validateSupplyParameters(parameters: SupplyParameters): void {
        if (parameters.subaccountId !== undefined && !isValidSubaccountId(parameters.subaccountId)) {
            throw new Error(`Supply validation failed: ${VALIDATION.ERRORS.INVALID_SUBACCOUNT_ID}`);
        }
    }

    /**
     * Creates a supply operation message
     * @param parameters - Supply operation parameters
     * @returns {Cell} Complete supply message cell
     * @throws {Error} When validation fails
     */
    createSupplyMessage(parameters: SupplyParameters): Cell {
        AbstractEvaaMaster.validateSupplyParameters(parameters);

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
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY, operationPayload);
        } else {
            return operationPayload;
        }
    }

    /**
     * Creates a supply-withdraw operation message
     * @abstract
     * @param parameters - Oracle-specific supply-withdraw parameters
     * @returns {Cell} Complete supply-withdraw message cell
     * @remarks Concrete classes must wrap the operation payload correctly for their oracle
     */
    abstract createSupplyWithdrawMessage(
        parameters: ClassicSupplyWithdrawParameters | PythSupplyWithdrawParameters,
    ): Cell;

    // ========== TRANSACTION OPERATIONS ==========
    /**
     * Sends a supply operation to the master contract
     * @param provider - Contract provider instance
     * @param via - Sender instance
     * @param value - Transaction value in nanoTON
     * @param parameters - Supply operation parameters
     * @throws {Error} When validation fails or transaction fails
     */
    async sendSupply(provider: ContractProvider, via: Sender, value: bigint, parameters: SupplyParameters) {
        const message = this.createSupplyMessage(parameters);

        await this.sendTx(provider, via, value, message, parameters.asset);
    }

    async sendSupplyWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: ClassicSupplyWithdrawParameters | PythSupplyWithdrawParameters,
    ) {
        const message = this.createSupplyWithdrawMessage(parameters);

        await this.sendTx(provider, via, value, message, parameters.supplyAsset);
    }

    // Abstract where oracle path differs
    abstract sendWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: ClassicWithdrawParameters | PythWithdrawParameters,
    ): Promise<void>;

    abstract createLiquidationMessage(parameters: ClassicLiquidationParameters | PythLiquidationParameters): Cell;

    protected buildLiquidationInnerBuilder(parameters: LiquidationInnerParameters): Builder {
        const subaccountId = parameters.subaccountId ?? 0;

        return beginCell()
            .storeRef(parameters.payload)
            .storeInt(subaccountId, 16)
            .storeAddress(parameters.customPayloadRecipient)
            .storeInt(parameters.customPayloadSaturationFlag ? -1 : 0, 2);
    }

    protected abstract buildLiquidationOperationPayload(
        parameters: PythLiquidationOperationParameters | ClassicLiquidationOperationParameters,
    ): Cell | Builder;

    protected buildLiquidationOperationPayloadBuilder(parameters: LiquidationOperationBuilderParameters): Builder {
        return beginCell()
            .storeAddress(parameters.borrowerAddress)
            .storeUint(parameters.collateralAsset, 256)
            .storeUint(parameters.minCollateralAmount, 64)
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeUint(isTonAsset(parameters.asset) ? parameters.liquidationAmount : 0, 64);
    }

    abstract sendLiquidation(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: ClassicLiquidationParameters | PythLiquidationParameters,
    ): Promise<void>;

    // ========== CONTRACT INTERACTION HELPERS ==========
    /**
     * Calculates the user smart contract address for a given user and subaccount
     * @param userAddress - The user's wallet address
     * @param lendingCode - The user contract code cell
     * @param subaccountId - Optional subaccount identifier (default: 0)
     * @returns {Address} The calculated user contract address
     * @throws {Error} When subaccount ID is invalid
     */
    calculateUserSCAddr(userAddress: Address, lendingCode: Cell, subaccountId: number = 0): Address {
        const subaccount = beginCell();
        if (subaccountId !== 0) {
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

    /**
     * Creates a user contract instance for the given address and subaccount
     * @param userAddress - The user's wallet address
     * @param subaccountId - Optional subaccount identifier (default: 0)
     * @returns {EvaaUser} User contract instance
     */
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

    async sendTx(provider: ContractProvider, via: Sender, value: bigint, message: Cell, asset: PoolAssetConfig) {
        if (!isTonAsset(asset)) {
            if (!via.address) throw new Error('Via address is required for jetton supply');
            const jettonWallet = provider.open(JettonWallet.createFromAddress(getUserJettonWallet(via.address, asset)));
            await jettonWallet.sendTransfer(via, value, message);
        } else {
            await provider.internal(via, {
                value,
                sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
                body: message,
            });
        }
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
            ) as T;
            if (this._data.upgradeConfig.masterCodeVersion !== this._poolConfig.masterVersion) {
                throw new Error(
                    `${VALIDATION.ERRORS.OUTDATED_SDK_VERSION}. SDK supports version ${this._poolConfig.masterVersion}, but contract version is ${this._data.upgradeConfig.masterCodeVersion}`,
                );
            }
            this.lastSync = Math.floor(Date.now() / 1000);
        } else {
            throw new Error(VALIDATION.ERRORS.MASTER_CONTRACT_INACTIVE);
        }
    }

    protected abstract getSync(provider: ContractProvider): Promise<void>;
}
