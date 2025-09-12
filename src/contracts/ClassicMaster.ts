import { beginCell, Builder, Cell, ContractProvider, Sender } from '@ton/core';
import { isTonAsset, LiquidationParameters, TON_MAINNET } from '..';
import { ClassicOracleInfo, ClassicOracleParser } from '../api/parsers/ClassicOracleParser';
import { FEES, OPCODES } from '../constants/general';
import {
    AbstractEvaaMaster,
    BaseMasterConfig,
    BaseMasterData,
    EvaaParameters,
    LiquidationInnerParameters,
    LiquidationOperationBuilderParameters,
    SupplyWithdrawParameters,
    WithdrawParameters,
} from './AbstractMaster';

export type ClassicSupplyWithdrawParameters = SupplyWithdrawParameters & {
    priceData?: Cell;
};

/**
 * Parameters for the withdraw message
 * @property priceData - price data cell. Can be obtained from the getPrices function
 */
export type ClassicWithdrawParameters = WithdrawParameters & {
    priceData: Cell;
};

export type ClassicLiquidationOperationParameters = LiquidationOperationBuilderParameters &
    LiquidationInnerParameters & {
        priceData: Cell;
    };

export type ClassicLiquidationParameters = LiquidationParameters & ClassicLiquidationOperationParameters;

export type ClassicMasterConfig = BaseMasterConfig & {
    oraclesInfo: ClassicOracleInfo;
};

export type ClassicMasterData = BaseMasterData & {
    masterConfig: ClassicMasterConfig;
};

export class EvaaMasterClassic extends AbstractEvaaMaster<ClassicMasterData> {
    constructor(parameters: EvaaParameters) {
        super(parameters);
    }

    buildGeneralDataPayload(parameters: ClassicSupplyWithdrawParameters): Cell {
        return beginCell()
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeMaybeRef(parameters.priceData)
            .storeUint(parameters.tonForRepayRemainings ?? 0n, 64)
            .storeRef(parameters.payload)
            .storeInt(parameters.subaccountId ?? 0, 16)
            .storeInt(parameters.returnRepayRemainingsFlag ? -1 : 0, 2)
            .storeInt(parameters.customPayloadSaturationFlag ? -1 : 0, 2)
            .endCell();
    }

    createSupplyWithdrawMessage(parameters: ClassicSupplyWithdrawParameters): Cell {
        const isTon = isTonAsset(parameters.supplyAsset);

        const operationPayload = this.buildSupplyWithdrawOperationPayload(parameters);

        const refOpCode = parameters.priceData
            ? OPCODES.SUPPLY_WITHDRAW_MASTER
            : OPCODES.SUPPLY_WITHDRAW_MASTER_WITHOUT_PRICES;

        if (!isTon) {
            return this.createJettonTransferMessage(
                parameters,
                FEES.SUPPLY_WITHDRAW,
                beginCell().storeUint(refOpCode, 32).storeSlice(operationPayload.beginParse()).endCell(),
            );
        } else {
            return beginCell()
                .storeUint(refOpCode, 32)
                .storeUint(parameters.queryID, 64)
                .storeSlice(operationPayload.beginParse())
                .endCell();
        }
    }

    async sendWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: ClassicWithdrawParameters,
    ): Promise<void> {
        // Compatibility layer using supply-withdraw with TON zero supply
        await this.sendSupplyWithdraw(provider, via, value, {
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
            priceData: parameters.priceData,
        });
    }

    protected buildLiquidationOperationPayload(parameters: ClassicLiquidationOperationParameters): Builder {
        const operationPayloadBuilder = this.buildLiquidationOperationPayloadBuilder(parameters);
        const innerBuilder = this.buildLiquidationInnerBuilder(parameters);

        return operationPayloadBuilder.storeRef(innerBuilder).storeRef(parameters.priceData);
    }

    protected createLiquidationMessage(parameters: ClassicLiquidationParameters): Cell {
        const isTon = isTonAsset(parameters.asset);
        const operationPayload = this.buildLiquidationOperationPayload(parameters);

        if (!isTon) {
            return this.createJettonTransferMessage(
                parameters,
                FEES.LIQUIDATION_JETTON_FWD,
                beginCell().storeUint(OPCODES.LIQUIDATE_MASTER, 32).storeBuilder(operationPayload).endCell(),
            );
        } else {
            return beginCell()
                .storeUint(OPCODES.LIQUIDATE_MASTER, 32)
                .storeUint(parameters.queryID, 64)
                .storeBuilder(operationPayload)
                .endCell();
        }
    }

    async sendLiquidation(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: ClassicLiquidationParameters,
    ): Promise<void> {
        const message = this.createLiquidationMessage(parameters);

        await this.sendTx(provider, via, value, message, parameters.asset);
    }

    async getSync(provider: ContractProvider) {
        await this.syncMasterData(provider, new ClassicOracleParser());
    }
}
