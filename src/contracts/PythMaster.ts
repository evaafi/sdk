import { HexString } from '@pythnetwork/hermes-client';
import { Address, beginCell, Cell, ContractProvider, Dictionary, Sender, SendMode } from '@ton/core';
import { PythOracleInfo, PythOracleParser } from '../api/parsers/PythOracleParser';
import { composeFeedsCell, packPythUpdatesData } from '../api/prices';
import { TON_MAINNET } from '../constants';
import { FEES, OPCODES } from '../constants/general';
import { PoolAssetConfig } from '../types/Master';
import { isTonAsset } from '../utils/utils';
import {
    AbstractEvaaMaster,
    BaseMasterConfig,
    BaseMasterData,
    EvaaParameters,
    JettonParams,
    LiquidationInnerParameters,
    LiquidationOperationBuilderParameters,
    LiquidationParameters,
    SupplyWithdrawParameters,
    WithdrawParameters,
} from './AbstractMaster';

/**
 * pyth specific parameters
 */
export interface PythBaseData {
    readonly priceData: Buffer | Cell;
    readonly targetFeeds: HexString[];
    readonly refAssets: PoolAssetConfig[];
}

export interface ProxySpecificPythParams {
    readonly pythAddress: Address;
    readonly minPublishTime: number | bigint;
    readonly maxPublishTime: number | bigint;
}

export interface OnchainSpecificPythParams {
    readonly publishGap: number | bigint;
    readonly maxStaleness: number | bigint;
}

export interface JettonPythParams extends PythBaseData, OnchainSpecificPythParams {}

export interface TonPythParams extends PythBaseData, ProxySpecificPythParams {}

export type PythProxyParams = {
    pyth: PythBaseData & (ProxySpecificPythParams | OnchainSpecificPythParams) & { pythAddress: Address };
};

export type PythSupplyWithdrawParameters = SupplyWithdrawParameters & Partial<PythProxyParams>;

export type PythWithdrawParameters = WithdrawParameters & {
    pyth?: TonPythParams;
};

export type PythLiquidationOperationParameters = LiquidationOperationBuilderParameters &
    LiquidationInnerParameters &
    PythProxyParams;

export type PythLiquidationParameters = LiquidationParameters & PythLiquidationOperationParameters;

// Specific master configurations
export interface PythMasterConfig extends BaseMasterConfig {
    readonly oraclesInfo: PythOracleInfo;
}

// Specific master data types
export interface PythMasterData extends BaseMasterData {
    readonly masterConfig: PythMasterConfig;
}

export class EvaaMasterPyth extends AbstractEvaaMaster<PythMasterData> {
    constructor(parameters: EvaaParameters) {
        super(parameters);
    }

    protected buildPythMasterMessage(
        args: {
            queryId: number | bigint;
            opCode: number | bigint;
            updateDataCell: Cell;
            targetFeedsCell: Cell;
            publishGap: number | bigint;
            maxStaleness: number | bigint;
        },
        operationPayload: Cell,
    ): Cell {
        return beginCell()
            .storeUint(args.opCode, 32)
            .storeUint(args.queryId, 64)
            .storeRef(
                beginCell()
                    .storeRef(args.updateDataCell)
                    .storeRef(args.targetFeedsCell)
                    .storeUint(args.publishGap, 64)
                    .storeUint(args.maxStaleness, 64)
                    .endCell(),
            )
            .storeRef(operationPayload)
            .endCell();
    }

    protected buildPythProxyMessage(
        targetAddress: Address,
        priceUpdateData: Cell,
        targetPythFeeds: Cell,
        minPublishTime: number | bigint,
        maxPublishTime: number | bigint,
        operationPayload: Cell,
    ): Cell {
        return beginCell()
            .storeUint(5, 32) // pyth::op_parse_price_feed_updates
            .storeRef(priceUpdateData)
            .storeRef(targetPythFeeds)
            .storeUint(minPublishTime, 64)
            .storeUint(maxPublishTime, 64)
            .storeAddress(targetAddress)
            .storeRef(operationPayload)
            .endCell();
    }

    /**
     * Creates a wrapped operation payload for TON assets
     */
    private createWrappedOperationPayload(opCode: number, queryID: number | bigint, operationPayload: Cell): Cell {
        return beginCell().storeUint(opCode, 32).storeUint(queryID, 64).storeRef(operationPayload).endCell();
    }

    /**
     * Creates a jetton transfer message with pyth data
     */
    private createJettonPythMessage(
        parameters: JettonParams & { queryID: number | bigint },
        operationPayload: Cell,
        pythParams: JettonPythParams,
        opCode: number,
    ): Cell {
        const { priceData, targetFeeds, publishGap, maxStaleness } = pythParams;
        const masterMessage = this.buildPythMasterMessage(
            {
                queryId: parameters.queryID,
                opCode,
                updateDataCell: packPythUpdatesData(priceData),
                targetFeedsCell: composeFeedsCell(targetFeeds),
                publishGap,
                maxStaleness,
            },
            operationPayload,
        );

        return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW, masterMessage);
    }

    /**
     * Creates a TON pyth proxy message
     */
    private createTonPythMessage(
        parameters: { queryID: number | bigint },
        operationPayload: Cell,
        pythParams: TonPythParams,
        opCode: number,
    ): Cell {
        const { priceData, targetFeeds, minPublishTime, maxPublishTime } = pythParams;
        const wrappedOperationPayload = this.createWrappedOperationPayload(
            opCode,
            parameters.queryID,
            operationPayload,
        );

        return this.buildPythProxyMessage(
            this.address,
            packPythUpdatesData(priceData),
            composeFeedsCell(targetFeeds),
            minPublishTime,
            maxPublishTime,
            wrappedOperationPayload,
        );
    }

    protected createSupplyWithdrawMessageNoPrices(parameters: SupplyWithdrawParameters, operationPayload: Cell): Cell {
        const messageBody = beginCell()
            .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER_WITHOUT_PRICES, 32)
            .storeSlice(operationPayload.beginParse())
            .endCell();

        if (!isTonAsset(parameters.supplyAsset)) {
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW + FEES.JETTON_FWD, messageBody);
        } else {
            return beginCell()
                .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER_WITHOUT_PRICES, 32)
                .storeUint(parameters.queryID, 64)
                .storeSlice(operationPayload.beginParse())
                .endCell();
        }
    }

    createSupplyWithdrawMessage(parameters: PythSupplyWithdrawParameters): Cell {
        const operationPayload = this.buildSupplyWithdrawOperationPayload(parameters);

        // Handle case without pyth data
        if (!parameters.pyth) {
            return this.createSupplyWithdrawMessageNoPrices(parameters, operationPayload);
        }

        if (!isTonAsset(parameters.supplyAsset)) {
            return this.createJettonPythMessage(
                parameters, // as JettonParams & { queryID: number | bigint },
                operationPayload,
                parameters.pyth as JettonPythParams,
                OPCODES.SUPPLY_WITHDRAW_MASTER_JETTON,
            );
        } else {
            return this.createTonPythMessage(
                parameters,
                operationPayload,
                parameters.pyth as TonPythParams,
                OPCODES.SUPPLY_WITHDRAW_MASTER,
            );
        }
    }

    buildRefTokensDict(refAssets: PoolAssetConfig[]): Dictionary<bigint, Buffer> {
        const refsDict: Dictionary<bigint, Buffer> = Dictionary.empty(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.Buffer(0),
        );
        for (const refAsset of refAssets) {
            refsDict.set(refAsset.assetId, Buffer.alloc(0));
        }

        return refsDict;
    }

    buildGeneralDataPayload(parameters: PythSupplyWithdrawParameters): Cell {
        const refTokensDict = this.buildRefTokensDict(parameters.pyth?.refAssets ?? []);
        return beginCell()
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeDict(refTokensDict, Dictionary.Keys.BigUint(256), Dictionary.Values.Buffer(0))
            .storeUint(parameters.tonForRepayRemainings ?? 0n, 64)
            .storeRef(parameters.payload)
            .storeInt(parameters.subaccountId ?? 0, 16)
            .storeInt(parameters.returnRepayRemainingsFlag ? -1 : 0, 2)
            .storeInt(parameters.customPayloadSaturationFlag ? -1 : 0, 2)
            .endCell();
    }

    async sendWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: PythWithdrawParameters,
    ): Promise<void> {
        const message = this.createSupplyWithdrawMessage({
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
            customPayloadSaturationFlag: parameters.customPayloadSaturationFlag ?? false,
            returnRepayRemainingsFlag: parameters.returnRepayRemainingsFlag ?? false,
            tonForRepayRemainings: 0n,
            pyth: parameters.pyth,
        });
        await via.send({
            value,
            to: parameters.pyth?.pythAddress ?? this.address,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: message,
        });
    }

    protected buildLiquidationOperationPayload(parameters: PythLiquidationOperationParameters): Cell {
        const operationPayloadBuilder = this.buildLiquidationOperationPayloadBuilder(parameters);
        const innerBuilder = this.buildLiquidationInnerBuilder(parameters);

        const refTokensDict = this.buildRefTokensDict(parameters.pyth.refAssets);

        return operationPayloadBuilder.storeDict(refTokensDict).storeRef(innerBuilder).endCell();
    }

    createLiquidationMessage(parameters: PythLiquidationParameters): Cell {
        const operationPayload = this.buildLiquidationOperationPayload(parameters);

        if (!isTonAsset(parameters.asset)) {
            return this.createJettonPythMessage(
                parameters,
                operationPayload,
                parameters.pyth as JettonPythParams,
                OPCODES.LIQUIDATE_MASTER,
            );
        } else {
            return this.createTonPythMessage(
                parameters,
                operationPayload,
                parameters.pyth as TonPythParams,
                OPCODES.LIQUIDATE_MASTER,
            );
        }
    }

    async sendLiquidation(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: PythLiquidationParameters,
    ): Promise<void> {
        const message = this.createLiquidationMessage(parameters);

        await this.sendTx(provider, via, value, message, parameters.asset);
    }

    async getSync(provider: ContractProvider) {
        await this.syncMasterData(provider, new PythOracleParser());
    }
}
