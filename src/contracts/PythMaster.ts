import { HexString } from '@pythnetwork/hermes-client';
import { beginCell, Cell, ContractProvider, Sender, SendMode } from '@ton/core';
import { isTonAsset, isTonAssetId, OnchainSpecificPythParams, PythWithdrawParameters } from '..';
import { PythOracleParser } from '../api/parser';
import { composeFeedsCell, packPythUpdatesData } from '../api/prices';
import { makeOnchainGetterMasterMessage, makePythProxyMessage } from '../api/pyth';
import { FEES, OPCODES } from '../constants/general';
import { getUserJettonWallet } from '../utils/userJettonWallet';
import {
    AbstractEvaaMaster,
    EvaaParameters,
    JettonPythParams,
    PythLiquidationParameters,
    SupplyWithdrawParameters,
    TonPythParams,
} from './AbstractMaster';
import { JettonWallet } from './JettonWallet';

export class EvaaMasterPyth extends AbstractEvaaMaster {
    constructor(parameters: EvaaParameters) {
        super(parameters);
    }

    protected createSupplyWithdrawMessage(parameters: SupplyWithdrawParameters): Cell {
        if (!parameters.pyth) {
            throw new Error('Pyth parameters are required for supply-withdraw in Pyth mode');
        }
        const operationPayload = this.buildSupplyWithdrawOperationPayload(parameters);

        if (!isTonAsset(parameters.supplyAsset)) {
            const { priceData, targetFeeds, publishGap, maxStaleness } = parameters.pyth as JettonPythParams;
            const masterMessage = makeOnchainGetterMasterMessage({
                queryId: parameters.queryID,
                opCode: OPCODES.SUPPLY_WITHDRAW_MASTER_JETTON,
                updateDataCell: packPythUpdatesData(priceData),
                targetFeedsCell: composeFeedsCell(targetFeeds),
                publishGap,
                maxStaleness,
                operationPayload,
            });
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW_JETTON_FWD, masterMessage);
        } else {
            const { priceData, targetFeeds, minPublishTime, maxPublishTime } = parameters.pyth as TonPythParams;
            const wrappedOperationPayload = beginCell()
                .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER, 32)
                .storeUint(parameters.queryID, 64)
                .storeRef(operationPayload)
                .endCell();
            return makePythProxyMessage(
                this.address,
                packPythUpdatesData(priceData),
                composeFeedsCell(targetFeeds),
                minPublishTime,
                maxPublishTime,
                wrappedOperationPayload,
            );
        }
    }

    private createPythWithdrawMessage(parameters: PythWithdrawParameters): Cell {
        const extraTail =
            (parameters.subaccountId ?? 0) == 0
                ? beginCell().endCell()
                : beginCell()
                      .storeInt(parameters.subaccountId ?? 0, 16)
                      .storeUint(0, 2)
                      .endCell();

        const { priceData, targetFeeds, minPublishTime, maxPublishTime } = parameters.pyth as TonPythParams;
        const wrappedOperationPayload = beginCell()
            .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER, 32)
            .storeUint(parameters.queryID, 64)
            .storeRef(
                beginCell()
                    .storeUint(parameters.asset.assetId, 256)
                    .storeUint(parameters.amount, 64)
                    .storeAddress(parameters.userAddress)
                    .storeInt(parameters.includeUserCode ? -1 : 0, 2)
                    .storeUint(parameters.amountToTransfer, 64)
                    .storeRef(parameters.payload)
                    .storeSlice(extraTail.beginParse())
                    .endCell(),
            )
            .endCell();

        return makePythProxyMessage(
            this.address,
            packPythUpdatesData(priceData),
            composeFeedsCell(targetFeeds),
            minPublishTime,
            maxPublishTime,
            wrappedOperationPayload,
        );
    }

    async sendWithdraw(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: PythWithdrawParameters,
    ): Promise<void> {
        const _parameters = { ...parameters };
        _parameters.pyth = { ...parameters.pyth, ...{ attachedValue: value } } as TonPythParams;
        const message = this.createPythWithdrawMessage(_parameters);
        await via.send({
            value,
            to: (_parameters.pyth as TonPythParams).pythAddress,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: message,
        });
    }

    protected createLiquidationMessage(parameters: PythLiquidationParameters): Cell {
        const subaccountId = parameters.subaccountId ?? 0;
        const isTon = isTonAsset(parameters.asset);
        const innerCell = beginCell().storeRef(parameters.payload);
        if (subaccountId != 0 || parameters.customPayloadRecipient || parameters.customPayloadSaturationFlag) {
            innerCell.storeInt(subaccountId, 16);
            innerCell.storeAddress(parameters.customPayloadRecipient);
            innerCell.storeInt(parameters.customPayloadSaturationFlag ? -1 : 0, 2);
        }

        const operationPayload = beginCell()
            .storeAddress(parameters.borrowerAddress)
            .storeUint(parameters.collateralAsset, 256)
            .storeUint(parameters.minCollateralAmount, 64)
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeUint(isTon ? parameters.liquidationAmount : 0, 64)
            .storeRef(innerCell)
            .endCell();

        if (!isTon) {
            const { priceData, targetFeeds, publishGap, maxStaleness } =
                parameters.pyth as OnchainSpecificPythParams & { priceData: Buffer | Cell; targetFeeds: HexString[] };
            const masterMessage = makeOnchainGetterMasterMessage({
                queryId: parameters.queryID,
                opCode: OPCODES.LIQUIDATE_MASTER,
                updateDataCell: packPythUpdatesData(priceData as Buffer | Cell),
                targetFeedsCell: composeFeedsCell(targetFeeds),
                publishGap,
                maxStaleness,
                operationPayload,
            });
            return this.createJettonTransferMessage(parameters, FEES.LIQUIDATION_JETTON_FWD, masterMessage);
        } else {
            const { priceData, targetFeeds, minPublishTime, maxPublishTime } = parameters.pyth as TonPythParams & {
                priceData: Buffer | Cell;
                targetFeeds: HexString[];
            };
            const wrappedOperationPayload = beginCell()
                .storeUint(OPCODES.LIQUIDATE_MASTER, 32)
                .storeUint(parameters.queryID, 64)
                .storeRef(operationPayload)
                .endCell();
            return makePythProxyMessage(
                this.address,
                packPythUpdatesData(priceData as Buffer | Cell),
                composeFeedsCell(targetFeeds),
                minPublishTime,
                maxPublishTime,
                wrappedOperationPayload,
            );
        }
    }

    async sendLiquidation(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        parameters: PythLiquidationParameters,
    ): Promise<void> {
        const _parameters = { ...parameters };
        // Preserve full PythBaseData + specific params, just augment with attachedValue
        const pythWithAttached: any = { ...(parameters.pyth as any), attachedValue: value };
        (_parameters as any).pyth = pythWithAttached;
        const message = this.createLiquidationMessage(_parameters);

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
        await this.syncMasterData(provider, new PythOracleParser());
    }
}
