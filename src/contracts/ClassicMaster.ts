import { beginCell, Cell, ContractProvider, Sender, SendMode } from '@ton/core';
import { isTonAsset, isTonAssetId, LiquidationParameters, TON_MAINNET, WithdrawParameters } from '..';
import { ClassicOracleParser } from '../api/parser';
import { FEES, OPCODES } from '../constants/general';
import { getUserJettonWallet } from '../utils/userJettonWallet';
import { AbstractEvaaMaster, EvaaParameters, SupplyWithdrawParameters } from './AbstractMaster';
import { JettonWallet } from './JettonWallet';

export class EvaaMasterClassic extends AbstractEvaaMaster {
    constructor(parameters: EvaaParameters) {
        super(parameters);
    }

    protected createSupplyWithdrawMessage(parameters: SupplyWithdrawParameters): Cell {
        const operationPayload = this.buildSupplyWithdrawOperationPayload(parameters);

        if (!isTonAsset(parameters.supplyAsset)) {
            return this.createJettonTransferMessage(
                parameters,
                FEES.SUPPLY_WITHDRAW_JETTON_FWD,
                beginCell()
                    .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER, 32)
                    .storeSlice(operationPayload.beginParse())
                    .endCell(),
            );
        } else {
            return beginCell()
                .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER, 32)
                .storeUint(parameters.queryID, 64)
                .storeSlice(operationPayload.beginParse())
                .endCell();
        }
    }

    async sendWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: WithdrawParameters,
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

    protected createLiquidationMessage(parameters: LiquidationParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;
        const isTon = isTonAsset(parameters.asset);

        const innerCell = beginCell().storeRef(parameters.payload);
        if (subaccountId != 0 || parameters.customPayloadRecipient || parameters.customPayloadSaturationFlag) {
            innerCell.storeInt(subaccountId, 16);
            innerCell.storeAddress(parameters.customPayloadRecipient);
            innerCell.storeUint(parameters.customPayloadSaturationFlag ? -1 : 0, 2);
        }

        const operationPayload = beginCell()
            .storeAddress(parameters.borrowerAddress)
            .storeUint(parameters.collateralAsset, 256)
            .storeUint(parameters.minCollateralAmount, 64)
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeUint(isTon ? parameters.liquidationAmount : 0, 64)
            .storeRef(innerCell)
            .storeRef(parameters.priceData);

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
        parameters: LiquidationParameters,
    ): Promise<void> {
        const message = this.createLiquidationMessage(parameters);

        if (!isTonAssetId(parameters.loanAsset)) {
            if (!via.address) throw Error('Via address is required for jetton liquidation');
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

    async getSync(provider: ContractProvider) {
        await this.syncMasterData(provider, new ClassicOracleParser());
    }
}
