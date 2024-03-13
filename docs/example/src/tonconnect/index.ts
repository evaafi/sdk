import { getConnector } from './connector';
import { ASSET_ID, Evaa, FEES, getLastSentBoc, getTonConnectSender } from '@evaafi/sdk';
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
            testnet: true,
        }),
    );
    await evaa.getSync();
    await evaa.sendSupply(getTonConnectSender(connector), toNano(1) + FEES.SUPPLY, {
        queryID: 0n,
        // we can set always to true, if we don't want to check user code version
        includeUserCode: true,
        amount: toNano(1),
        userAddress: Address.parse(connector.wallet!.account.address),
        assetID: ASSET_ID.TON,
        type: 'ton',
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
