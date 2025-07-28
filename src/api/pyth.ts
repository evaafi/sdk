// user --> pyth --> target
import {Address, beginCell} from "@ton/ton";
import {Cell, Slice} from "@ton/core";

export function makePythProxyMessage(
    targetAddress: Address,
    priceUpdateData: Cell,
    targetPythFeeds: Cell,
    minPublishTime: number|bigint,
    maxPublishTime: number|bigint,
    operationPayload: Cell): Cell {

    return beginCell()
        .storeUint(5, 32)   // pyth::op_parse_price_feed_updates
        .storeRef(priceUpdateData)
        .storeRef(targetPythFeeds)
        .storeUint(minPublishTime, 64)
        .storeUint(maxPublishTime, 64)
        .storeAddress(targetAddress)    // inform pyth where to send positive response
        .storeRef(operationPayload)
        .endCell();
}

/**
 * This operation jetton transfer notification sends to master address
 * @param args
 */
export function makeOnchainGetterMasterMessage(args: {
    queryId: number | bigint,
    opCode: number | bigint,
    updateDataCell: Cell,
    targetFeedsCell: Cell,
    publishGap: number | bigint,
    maxStaleness: number | bigint,
    operationPayload: Cell
}) {
    return beginCell()
        .storeUint(args.opCode, 32)
        .storeUint(args.queryId, 64)
        .storeRef(
            beginCell()
                .storeRef(args.updateDataCell)
                .storeRef(args.targetFeedsCell)
                .storeUint(args.publishGap, 64)
                .storeUint(args.maxStaleness, 64)
                .endCell())
        .storeRef(args.operationPayload)
        .endCell();
}
