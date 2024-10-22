import { getConnector } from './connector';
import { Evaa, FEES, getLastSentBoc, getTonConnectSender, TESTNET_POOL_CONFIG, TON_MAINNET } from '@evaafi/sdk';
import { Cell, toNano, TonClient } from '@ton/ton';
import { configDotenv } from 'dotenv';
import { Address } from '@ton/core';

async function index() {
    configDotenv();
    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
    const connector = await getConnector();
    const evaa = client.open(
        new Evaa({
            poolConfig: TESTNET_POOL_CONFIG
        }),
    );
    await evaa.getSync();
    await evaa.sendSupply(getTonConnectSender(connector), toNano(1) + FEES.SUPPLY, {
        queryID: 0n,
        // we can set always to true, if we don't want to check user code version
        includeUserCode: true,
        amount: toNano(1),
        userAddress: Address.parse(connector.wallet!.account.address),
        asset: TON_MAINNET,
        payload: Cell.EMPTY,
        amountToTransfer: 0n
    });
    const lastSentBoc = getLastSentBoc();
    console.log(lastSentBoc);
    console.log(
        `https://testnet.tonviewer.com/transaction/${Cell.fromBase64(lastSentBoc!.boc).hash().toString('hex')}`,
    );
    // pause connection to prevent memory leaks
    connector.pauseConnection();
}

index();
