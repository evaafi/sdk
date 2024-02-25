import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode, storeStateInit } from '@ton/core';
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

export type EvaaParameters = {
    testnet: boolean;
    syncInterval?: number;
    provider?: ContractProvider;
    debug?: boolean;
};

export type JettonMessageParameters = {
    responseAddress?: Address;
    forwardAmount?: bigint;
};

export type SupplyBaseParameters = {
    queryID: number;
    includeUserCode: boolean;
    amount: bigint;
    userAddress: Address;
    assetID: bigint;
};
export type TonSupplyParameters = SupplyBaseParameters & {
    type: 'ton';
};
export type JettonSupplyParameters = SupplyBaseParameters &
    JettonMessageParameters & {
        type: 'jetton';
    };

export type WithdrawParameters = {
    queryID: number;
    assetID: bigint;
    amount: bigint;
    userAddress: Address;
    includeUserCode: boolean;
    priceData: Cell;
};

export type LiquidationBaseData = {
    borrowerAddress: Address;
    loanAsset: bigint;
    collateralAsset: bigint;
    minCollateralAmount: bigint;
    liquidationAmount: bigint;
    tonLiquidation: boolean;
};

export type LiquidationBaseParameters = LiquidationBaseData & {
    queryID: number;
    liquidatorAddress: Address;
    includeUserCode: boolean;
    priceData: Cell;
};

export type TonLiquidationParameters = LiquidationBaseParameters & {
    type: 'ton';
};
export type JettonLiquidationParameters = LiquidationBaseParameters &
    JettonMessageParameters & {
        type: 'jetton';
    };

export class Evaa implements Contract {
    readonly address: Address = EVAA_MASTER_MAINNET;
    readonly network: 'mainnet' | 'testnet' = 'mainnet';
    private readonly debug?: boolean;
    private _data?: MasterData;
    private lastSync = 0;

    constructor(parameters?: EvaaParameters) {
        if (parameters?.testnet) {
            this.network = 'testnet';
            this.address = EVAA_MASTER_TESTNET;
        }
        this.debug = parameters?.debug;
    }

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

    openUserContract(userAddress: Address): EvaaUser {
        return EvaaUser.createFromAddress(this.calculateUserSCAddr(userAddress));
    }

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

        if ('forwardAmount' in parameters) {
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

        if ('forwardAmount' in parameters) {
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

    async getSync(provider: ContractProvider) {
        const state = (await provider.getState()).state;
        if (state.type === 'active') {
            this._data = parseMasterData(state.data!.toString('base64url'));
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
