import { configDotenv } from 'dotenv';
import { mnemonicToWalletKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { ASSET_ID, Evaa, FEES, getPrices } from '@evaafi/sdk';

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
    const priceData = await getPrices();
    await evaa.sendWithdraw(wallet.sender(keyPair.secretKey), FEES.WITHDRAW, {
        queryID: 0n,
        // we can set always to true, if we don't want to check user code version
        includeUserCode: true,
        assetID: ASSET_ID.jUSDT,
        priceData: priceData!.dataCell,
        amount: 500_000n,
        userAddress: wallet.address,
    });
}

main();
