import { configDotenv } from 'dotenv';
import { SendMode, toNano, TonClient, WalletContractV4 } from '@ton/ton';
import { ASSET_ID, Evaa, FEES } from '@evaafi/sdk';
import { mnemonicToWalletKey } from '@ton/crypto';
import { beginCell, external, internal, storeMessage } from '@ton/core';

async function main() {
    configDotenv();
    const keyPair = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC!.split(' '));
    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
    const evaa = client.open(
        new Evaa({
            testnet: true,
        }),
    );
    const wallet = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey,
        }),
    );
    // get supply message body
    const supplyMessage = evaa.createSupplyMessage({
        queryID: 0n,
        // we can set always to true, if we don't want to check user code version
        includeUserCode: true,
        amount: toNano(1),
        userAddress: wallet.address,
        assetID: ASSET_ID.TON,
        type: 'ton',
    });
    // create signed transfer for out wallet with internal message to EVAA Master Contract
    const signedMessage = wallet.createTransfer({
        seqno: await wallet.getSeqno(),
        secretKey: keyPair.secretKey,
        messages: [
            internal({
                to: evaa.address,
                value: toNano(1) + FEES.SUPPLY,
                body: supplyMessage,
            }),
        ],
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        timeout: Math.floor(Date.now() / 1000) + 60,
    });
    // send this message. send() method creates external and send it, so
    // we need to create external message manually for getting its hash
    await wallet.send(signedMessage);

    // create external message manually
    const externalMessage = beginCell()
        .store(
            storeMessage(
                external({
                    to: wallet.address,
                    body: signedMessage,
                }),
            ),
        )
        .endCell();
    // get external message hash and link to tonviewer
    console.log(`https://testnet.tonviewer.com/transaction/${externalMessage.hash().toString('hex')}`);
}

main();
