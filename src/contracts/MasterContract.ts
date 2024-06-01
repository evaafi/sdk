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
import {
    EVAA_MASTER_MAINNET,
    EVAA_MASTER_TESTNET,
    FEES,
    LENDING_CODE,
    MAINNET_VERSION,
    OPCODES,
    TESTNET_VERSION,
} from '../constants';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { EvaaUser } from './UserContract';
import { parseMasterData } from '../api/parser';
import { MasterData } from '../types/Master';
import { JettonWallet } from './JettonWallet';
import { getUserJettonWallet } from '../utils/userJettonWallet';

/**
 * Parameters for the Evaa contract
 * @property testnet - true for testnet, false for mainnet
 * @property debug - true to enable debug mode (optional)
 */
export type EvaaParameters = {
    testnet: boolean;
    debug?: boolean;
};

/**
 * Parameters for the Jetton message
 * @property responseAddress - address to send excesses
 * @property forwardAmount - amount to forward to the destination address
 */
export type JettonMessageParameters = {
    responseAddress?: Address;
    forwardAmount?: bigint;
};

/**
 * Base parameters for supply
 * @property queryID - unique query ID
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property amount - amount to supply
 * @property userAddress - user address
 * @property assetID - asset ID
 */
export type SupplyBaseParameters = {
    queryID: bigint;
    includeUserCode: boolean;
    amount: bigint;
    userAddress: Address;
    assetID: bigint;
};
/**
 * Parameters for the TON supply message
 * @property type - 'ton'
 */
export type TonSupplyParameters = SupplyBaseParameters & {
    type: 'ton';
};
/**
 * Parameters for the jetton supply message
 * @property type - 'jetton'
 */
export type JettonSupplyParameters = SupplyBaseParameters &
    JettonMessageParameters & {
        type: 'jetton';
    };

/**
 * Parameters for the withdraw message
 * @property queryID - unique query ID
 * @property assetID - asset ID
 * @property amount - amount to withdraw
 * @property userAddress - user address
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type WithdrawParameters = {
    queryID: bigint;
    assetID: bigint;
    amount: bigint;
    userAddress: Address;
    includeUserCode: boolean;
    priceData: Cell;
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
};

/**
 * Base parameters for liquidation
 * @property queryID - unique query ID
 * @property liquidatorAddress - liquidator address, where and collateral will be sent
 * @property includeUserCode - true to include user code for update (needed when user contract code version is outdated)
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type LiquidationBaseParameters = LiquidationBaseData & {
    queryID: bigint;
    liquidatorAddress: Address;
    includeUserCode: boolean;
    priceData: Cell;
};

/**
 * Parameters for the TON liquidation message
 * @property type - 'ton'
 */
export type TonLiquidationParameters = LiquidationBaseParameters & {
    type: 'ton';
};
/**
 * Parameters for the jetton liquidation message
 * @property type - 'jetton'
 */
export type JettonLiquidationParameters = LiquidationBaseParameters &
    JettonMessageParameters & {
        type: 'jetton';
    };

/**
 * Evaa master contract wrapper
 */
export class Evaa implements Contract {
    readonly address: Address = EVAA_MASTER_MAINNET;
    readonly network: 'mainnet' | 'testnet' = 'mainnet';
    private readonly debug?: boolean;
    private _data?: MasterData;
    private lastSync = 0;

    /**
     * Create Evaa contract wrapper
     * @param parameters Evaa contract parameters
     */
    constructor(parameters?: EvaaParameters) {
        if (parameters?.testnet) {
            this.network = 'testnet';
            this.address = EVAA_MASTER_TESTNET;
        }
        this.debug = parameters?.debug;
    }

    /**
     * Create supply message
     * @returns supply message as a cell
     */
    createSupplyMessage(parameters: TonSupplyParameters | JettonSupplyParameters): Cell {
        if (parameters.type === 'jetton') {
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
                .endCell();
        }
    }

    /**
     * Create withdraw message
     * @returns withdraw message as a cell
     */
    createWithdrawMessage(parameters: WithdrawParameters): Cell {
        return beginCell()
            .storeUint(OPCODES.WITHDRAW, 32)
            .storeUint(parameters.queryID, 64)
            .storeUint(parameters.assetID, 256)
            .storeUint(parameters.amount, 64)
            .storeAddress(parameters.userAddress)
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeRef(parameters.priceData)
            .endCell();
    }

    /**
     * Create liquidation message
     * @returns liquidation message as a cell
     */
    createLiquidationMessage(parameters: TonLiquidationParameters | JettonLiquidationParameters): Cell {
        if (parameters.type === 'jetton') {
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
                .storeRef(parameters.priceData)
                .endCell();
        }
    }

    /**
     * Calculate user contract address
     * @param userAddress
     * @returns user contract address
     */
    calculateUserSCAddr(userAddress: Address): Address {
        const lendingData = beginCell()
            .storeAddress(this.address)
            .storeAddress(userAddress)
            .storeUint(0, 8)
            .storeBit(0)
            .endCell();

        const stateInit = beginCell()
            .store(
                storeStateInit({
                    code: LENDING_CODE,
                    data: lendingData,
                }),
            )
            .endCell();
        return new Address(0, stateInit.hash());
    }

    /**
     * Open user contract wrapper
     * @param userAddress
     * @returns user contract
     */
    openUserContract(userAddress: Address): EvaaUser {
        return EvaaUser.createFromAddress(this.calculateUserSCAddr(userAddress), this.network === 'testnet');
    }

    getOpenedUserContract(provider: ContractProvider, userAddress: Address): OpenedContract<EvaaUser> {
        return provider.open(this.openUserContract(userAddress));
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
        parameters: TonSupplyParameters | JettonSupplyParameters,
    ) {
        const message = this.createSupplyMessage(parameters);

        if (parameters.type === 'jetton') {
            if (!via.address) {
                throw Error('Via address is required for jetton supply');
            }
            const jettonWallet = provider.open(
                JettonWallet.createFromAddress(getUserJettonWallet(via.address, parameters.assetID, this.network)),
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
        parameters: TonLiquidationParameters | JettonLiquidationParameters,
    ) {
        const message = this.createLiquidationMessage(parameters);

        if (parameters.type === 'jetton') {
            if (!via.address) {
                throw Error('Via address is required for jetton liquidation');
            }
            const jettonWallet = provider.open(
                JettonWallet.createFromAddress(getUserJettonWallet(via.address, parameters.loanAsset, this.network)),
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
            this._data = parseMasterData(state.data!.toString('base64url'), this.network === 'testnet');
            if (this.network === 'testnet' && this._data.upgradeConfig.masterCodeVersion !== TESTNET_VERSION) {
                throw Error(
                    `Outdated SDK version. It supports only master code version ${TESTNET_VERSION} on testnet, but the current master code version is ${this._data.upgradeConfig.masterCodeVersion}`,
                );
            }
            if (this.network === 'mainnet' && this._data.upgradeConfig.masterCodeVersion !== MAINNET_VERSION) {
                throw Error(
                    `Outdated SDK version. It supports only master code version ${MAINNET_VERSION} on mainnet, but the current master code version is ${this._data.upgradeConfig.masterCodeVersion}`,
                );
            }
            this.lastSync = Math.floor(Date.now() / 1000);
        } else {
            throw Error('Master contract is not active');
        }
    }
}
