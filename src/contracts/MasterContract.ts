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
import { DefaultPriceSourcesConfig, getPrices, isTonAsset, isTonAssetId, MAINNET_POOL_CONFIG, PricesCollector, PriceSourcesConfig } from '..';

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
    amountToTransfer: bigint;
    payload: Cell;
    subaccountId?: number;
    returnRepayRemainingsFlag: boolean;
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
    amountToTransfer: bigint;
    payload: Cell;
    subaccountId?: number;
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

    /**
     * Create supply message
     * @returns supply message as a cell
     */
    createSupplyMessage(parameters: SupplyParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;
        const subaccount = beginCell().storeInt(subaccountId, 16);
        if (!isTonAsset(parameters.asset)) {
            return beginCell()
                .storeUint(OPCODES.JETTON_TRANSFER, 32)
                .storeUint(parameters.queryID, 64)
                .storeCoins(parameters.amount)
                .storeAddress(this.address)
                .storeAddress(parameters.responseAddress ?? parameters.userAddress)
                .storeBit(0)
                .storeCoins(parameters.forwardAmount ?? FEES.SUPPLY_JETTON_FWD)
                .storeBit(1)
                .storeRef(
                    beginCell()
                        .storeUint(OPCODES.SUPPLY, 32)
                        .storeInt(parameters.includeUserCode ? -1 : 0, 2)
                        .storeAddress(parameters.userAddress)
                        .storeUint(parameters.amountToTransfer, 64)
                        .storeRef(parameters.payload)
                        .storeBuilder(subaccount)
                        .storeInt(parameters.returnRepayRemainingsFlag ? -1 : 0, 2)
                        .endCell(),
                )
                .endCell();
        } else {
            return beginCell()
                .storeUint(OPCODES.SUPPLY, 32)
                .storeUint(parameters.queryID, 64)
                .storeInt(parameters.includeUserCode ? -1 : 0, 2)
                .storeUint(parameters.amount, 64)
                .storeAddress(parameters.userAddress)
                .storeUint(parameters.amountToTransfer, 64)
                .storeRef(parameters.payload)
                .storeBuilder(subaccount)
                .storeInt(parameters.returnRepayRemainingsFlag ? -1 : 0, 2)
                .endCell();
        }
    }

    /**
     * Create withdraw message
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
            .endCell();
    }

    /**
     * Create liquidation message
     * @returns liquidation message as a cell
     */
    createLiquidationMessage(parameters: LiquidationParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;
        const subaccount = beginCell().storeInt(subaccountId, 16);
        if (!isTonAsset(parameters.asset)) {
            return beginCell()
                .storeUint(OPCODES.JETTON_TRANSFER, 32)
                .storeUint(parameters.queryID, 64)
                .storeCoins(parameters.liquidationAmount)
                .storeAddress(this.address)
                .storeAddress(parameters.responseAddress ?? parameters.liquidatorAddress)
                .storeBit(0)
                .storeCoins(parameters.forwardAmount ?? FEES.LIQUIDATION_JETTON_FWD)
                .storeBit(1)
                .storeRef(
                    beginCell()
                        .storeUint(OPCODES.LIQUIDATE, 32)
                        .storeAddress(parameters.borrowerAddress)
                        .storeAddress(parameters.liquidatorAddress)
                        .storeUint(parameters.collateralAsset, 256)
                        .storeUint(parameters.minCollateralAmount, 64)
                        .storeInt(parameters.includeUserCode ? -1 : 0, 2)
                        // do not need liquidationAmount in case of jetton liquidation because
                        // the exact amount of transferred jettons for liquidation is known
                        .storeUint(0, 64)
                        .storeRef(beginCell()
                            .storeUint(parameters.payloadForwardAmount ?? 0, 64)
                            .storeRef(parameters.payload)
                            .storeBuilder(subaccount)
                            .endCell())
                        .storeRef(parameters.priceData)
                        .endCell(),
                )
                .endCell();
        } else {
            return beginCell()
                .storeUint(OPCODES.LIQUIDATE, 32)
                .storeUint(parameters.queryID, 64)
                .storeAddress(parameters.borrowerAddress)
                .storeAddress(parameters.liquidatorAddress)
                .storeUint(parameters.collateralAsset, 256)
                .storeUint(parameters.minCollateralAmount, 64)
                .storeInt(parameters.includeUserCode ? -1 : 0, 2)
                .storeUint(parameters.liquidationAmount, 64)
                .storeRef(beginCell()
                    .storeUint(parameters.payloadForwardAmount ?? 0, 64)
                    .storeRef(parameters.payload)
                    .storeBuilder(subaccount)
                    .endCell())
                .storeRef(parameters.priceData)
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

    async sendWithdraw(provider: ContractProvider, via: Sender, value: bigint, parameters: WithdrawParameters) {
        const message = this.createWithdrawMessage(parameters);

        await provider.internal(via, {
            value,
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

    createPriceCollector(priceSourcesConfig: PriceSourcesConfig = DefaultPriceSourcesConfig): PricesCollector {
        return new PricesCollector(this._poolConfig, priceSourcesConfig);
    }
}
