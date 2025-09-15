import { HexString } from '@pythnetwork/hermes-client';
import { Address, beginCell, Cell, ContractProvider, Dictionary, Sender, SendMode } from '@ton/core';
import { PythOracleInfo, PythOracleParser } from '../api/parsers/PythOracleParser';
import { composeFeedsCell, packPythUpdatesData } from '../api/prices';
import { TON_MAINNET } from '../constants';
import { FEES, OPCODES } from '../constants/general';
import { isTonAsset } from '../utils/utils';
import {
    AbstractEvaaMaster,
    BaseMasterConfig,
    BaseMasterData,
    EvaaParameters,
    LiquidationInnerParameters,
    LiquidationOperationBuilderParameters,
    LiquidationParameters,
    SupplyWithdrawParameters,
    WithdrawParameters,
} from './AbstractMaster';

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
    minPublishTime: number | bigint;
    maxPublishTime: number | bigint;
};

export type OnchainSpecificPythParams = {
    publishGap: number | bigint;
    maxStaleness: number | bigint;
};

export type JettonPythParams = PythBaseData & OnchainSpecificPythParams;

export type TonPythParams = PythBaseData & ProxySpecificPythParams;

export type PythProxyParams = {
    pyth: PythBaseData & (ProxySpecificPythParams | OnchainSpecificPythParams) & { pythAddress: Address };
};

export type PythSupplyWithdrawParameters = SupplyWithdrawParameters & Partial<PythProxyParams>;

export type PythWithdrawParameters = WithdrawParameters & {
    pyth: TonPythParams;
};

export type PythLiquidationOperationParameters = LiquidationOperationBuilderParameters &
    LiquidationInnerParameters &
    PythProxyParams;

export type PythLiquidationParameters = LiquidationParameters & PythLiquidationOperationParameters;

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

    // TODO: support without OPCODES.SUPPLY_WITHDRAW_MASTER_WITHOUT_PRICES
    createSupplyWithdrawMessage(parameters: PythSupplyWithdrawParameters): Cell {
        const operationPayload = this.buildSupplyWithdrawOperationPayload(parameters);

        if (!isTonAsset(parameters.supplyAsset)) {
            const { priceData, targetFeeds, publishGap, maxStaleness } = parameters.pyth as JettonPythParams;
            const masterMessage = this.buildPythMasterMessage(
                {
                    queryId: parameters.queryID,
                    opCode: OPCODES.SUPPLY_WITHDRAW_MASTER_JETTON,
                    updateDataCell: packPythUpdatesData(priceData),
                    targetFeedsCell: composeFeedsCell(targetFeeds),
                    publishGap,
                    maxStaleness,
                },
                operationPayload,
            );

            return this.createJettonTransferMessage(parameters, FEES.SUPPLY_WITHDRAW, masterMessage);
        } else {
            const { priceData, targetFeeds, minPublishTime, maxPublishTime } = parameters.pyth as TonPythParams;
            const wrappedOperationPayload = beginCell()
                .storeUint(OPCODES.SUPPLY_WITHDRAW_MASTER, 32)
                .storeUint(parameters.queryID, 64)
                .storeRef(operationPayload)
                .endCell();
            return this.buildPythProxyMessage(
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

    buildRefTokensDict(requestedRefTokens: bigint[]): Dictionary<bigint, Buffer> {
        const refsDict: Dictionary<bigint, Buffer> = Dictionary.empty(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.Buffer(0),
        );
        for (const refToken of requestedRefTokens) {
            refsDict.set(refToken, Buffer.alloc(0));
        }

        return refsDict;
    }

    buildGeneralDataPayload(parameters: PythSupplyWithdrawParameters): Cell {
        const refTokensDict = this.buildRefTokensDict(parameters.pyth?.requestedRefTokens ?? []);
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
            to: parameters.pyth.pythAddress,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: message,
        });
    }

    protected buildLiquidationOperationPayload(parameters: PythLiquidationOperationParameters): Cell {
        const operationPayloadBuilder = this.buildLiquidationOperationPayloadBuilder(parameters);
        const innerBuilder = this.buildLiquidationInnerBuilder(parameters);

        const refTokensDict = this.buildRefTokensDict(parameters.pyth.requestedRefTokens);

        return operationPayloadBuilder.storeDict(refTokensDict).storeRef(innerBuilder).endCell();
    }

    createLiquidationMessage(parameters: PythLiquidationParameters): Cell {
        const isTon = isTonAsset(parameters.asset);

        const operationPayload = this.buildLiquidationOperationPayload(parameters);

        if (!isTon) {
            const { priceData, targetFeeds, publishGap, maxStaleness } =
                parameters.pyth as OnchainSpecificPythParams & { priceData: Buffer | Cell; targetFeeds: HexString[] };
            const masterMessage = this.buildPythMasterMessage(
                {
                    queryId: parameters.queryID,
                    opCode: OPCODES.LIQUIDATE_MASTER,
                    updateDataCell: packPythUpdatesData(priceData as Buffer | Cell),
                    targetFeedsCell: composeFeedsCell(targetFeeds),
                    publishGap,
                    maxStaleness,
                },
                operationPayload,
            );
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
            return this.buildPythProxyMessage(
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
        const message = this.createLiquidationMessage(parameters);

        await this.sendTx(provider, via, value, message, parameters.asset);
    }

    async getSync(provider: ContractProvider) {
        await this.syncMasterData(provider, new PythOracleParser());
    }
}
