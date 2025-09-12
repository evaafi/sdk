import { HexString } from '@pythnetwork/hermes-client';
import { Address, beginCell, Cell, ContractProvider, Dictionary, Sender, SendMode } from '@ton/core';
import { PythOracleInfo, PythOracleParser } from '../api/parsers/PythOracleParser';
import { composeFeedsCell, packPythUpdatesData } from '../api/prices';
import { makeOnchainGetterMasterMessage, makePythProxyMessage } from '../api/pyth';
import { TON_MAINNET } from '../constants';
import { FEES, OPCODES } from '../constants/general';
import { getUserJettonWallet } from '../utils/userJettonWallet';
import { isTonAsset, isTonAssetId } from '../utils/utils';
import {
    AbstractEvaaMaster,
    BaseMasterConfig,
    BaseMasterData,
    EvaaParameters,
    LiquidationParameters,
    SupplyWithdrawParameters,
    WithdrawParameters,
} from './AbstractMaster';
import { JettonWallet } from './JettonWallet';

/**
 * pyth specific parameters
 */
export type PythBaseData = {
    priceData: Buffer | Cell;
    targetFeeds: HexString[];
    requestedRefTokens: bigint[];
};

export type ProxySpecificPythParams = {
    pythAddress: Address;
    // attachedValue: bigint;
    minPublishTime: number | bigint;
    maxPublishTime: number | bigint;
};

export type OnchainSpecificPythParams = {
    publishGap: number | bigint;
    maxStaleness: number | bigint;
};

export type JettonPythParams = PythBaseData & OnchainSpecificPythParams;

export type TonPythParams = PythBaseData & ProxySpecificPythParams;

export type PythSupplyWithdrawParameters = SupplyWithdrawParameters & {
    pyth?: PythBaseData & (ProxySpecificPythParams | OnchainSpecificPythParams);
};

export type PythWithdrawParameters = WithdrawParameters & {
    pyth: TonPythParams;
};

export type PythLiquidationParameters = LiquidationParameters & {
    pyth: PythBaseData & (ProxySpecificPythParams | OnchainSpecificPythParams);
};

// Specific master configurations
export type PythMasterConfig = BaseMasterConfig & {
    oraclesInfo: PythOracleInfo;
};

// Specific master data types
export type PythMasterData = BaseMasterData & {
    masterConfig: PythMasterConfig;
};

export class EvaaMasterPyth extends AbstractEvaaMaster<PythMasterData> {
    constructor(parameters: EvaaParameters) {
        super(parameters);
    }

    createSupplyWithdrawMessage(parameters: PythSupplyWithdrawParameters): Cell {
        const operationPayload = this.buildSupplyWithdrawOperationPayload(parameters);

        // Handle case without pyth parameters
        // if (!parameters.pyth) {
        //     const refOpCode = OPCODES.SUPPLY_WITHDRAW_MASTER_WITHOUT_PRICES;

        //     if (!isTonAsset(parameters.supplyAsset)) {
        //         return this.createJettonTransferMessage(
        //             parameters,
        //             FEES.SUPPLY_WITHDRAW,
        //             beginCell().storeUint(refOpCode, 32).storeSlice(operationPayload.beginParse()).endCell(),
        //         );
        //     } else {
        //         return beginCell()
        //             .storeUint(refOpCode, 32)
        //             .storeUint(parameters.queryID, 64)
        //             .storeSlice(operationPayload.beginParse())
        //             .endCell();
        //     }
        // }

        // Handle case with pyth parameters (existing logic)
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
            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW, masterMessage);
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

    // private createPythWithdrawMessage(parameters: PythWithdrawParameters): Cell {
    //     const extraTail =
    //         (parameters.subaccountId ?? 0) == 0
    //             ? beginCell().endCell()
    //             : beginCell()
    //                   .storeInt(parameters.subaccountId ?? 0, 16)
    //                   .storeUint(0, 2)
    //                   .endCell();

    //     const wrappedOperationPayload = beginCell()
    //         .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER, 32) // op_code: 0x4
    //         .storeUint(parameters.queryID, 64)
    //         .storeRef(
    //             beginCell()
    //                 .storeUint(parameters.asset.assetId, 256)
    //                 .storeUint(parameters.amount, 64)
    //                 .storeAddress(parameters.userAddress)
    //                 .storeInt(parameters.includeUserCode ? -1 : 0, 2)
    //                 .storeUint(parameters.amountToTransfer, 64)
    //                 .storeRef(parameters.payload)
    //                 .storeSlice(extraTail.beginParse())
    //                 .endCell(),
    //         )
    //         .endCell();

    //     const { priceData, targetFeeds, minPublishTime, maxPublishTime } = parameters.pyth as TonPythParams;

    //     return makePythProxyMessage(
    //         this.address,
    //         packPythUpdatesData(priceData),
    //         composeFeedsCell(targetFeeds),
    //         minPublishTime,
    //         maxPublishTime,
    //         wrappedOperationPayload,
    //     );
    // }


    buildGeneralDataPayload(parameters: PythSupplyWithdrawParameters): Cell {
        const refsDict: Dictionary<bigint, Buffer> = Dictionary.empty(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.Buffer(0),
        );

        for (const refToken of parameters.pyth?.requestedRefTokens ?? []) {
            refsDict.set(refToken, Buffer.alloc(0));
        }
        return beginCell()
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeDict(refsDict, Dictionary.Keys.BigUint(256), Dictionary.Values.Buffer(0))
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
        const _parameters = { ...parameters };
        _parameters.pyth = { ...parameters.pyth, ...{ attachedValue: value } } as TonPythParams;
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
            pyth: _parameters.pyth,
        });
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
        if (subaccountId !== 0 || parameters.customPayloadRecipient || parameters.customPayloadSaturationFlag) {
            innerCell.storeInt(subaccountId, 16);
            innerCell.storeAddress(parameters.customPayloadRecipient);
            innerCell.storeInt(parameters.customPayloadSaturationFlag ? -1 : 0, 2);
        }

        const refsDict: Dictionary<bigint, Buffer> = Dictionary.empty(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.Buffer(0),
        );
        for (const refToken of parameters.pyth.requestedRefTokens) {
            refsDict.set(refToken, Buffer.alloc(0));
        }

        const operationPayload = beginCell()
            .storeAddress(parameters.borrowerAddress)
            .storeUint(parameters.collateralAsset, 256)
            .storeUint(parameters.minCollateralAmount, 64)
            .storeInt(parameters.includeUserCode ? -1 : 0, 2)
            .storeUint(isTon ? parameters.liquidationAmount : 0, 64)
            .storeDict(refsDict)
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
