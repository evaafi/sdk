import 'dotenv/config';

import { mnemonicToWalletKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { EvaaMasterPyth, MAINNET_POOL_CONFIG } from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://rpc.evaa.space/api/v2/jsonRPC',
    apiKey: process.env.EVAA_RPC_KEY,
});

async function withdrawTON() {
    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC!.split(' '));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: WALLET_KEY_PAIR.publicKey,
        }),
    );

    console.log(WALLET_CONTRACT.address.toString());
    const balance = await WALLET_CONTRACT.getBalance();
    // console.log(balance);
    if (balance == 0n) {
        console.log(`Wallet ${WALLET_CONTRACT.address} balance is 0, nothing to do`);
        return;
    }

    const EVAA_MAINNET = TON_CLIENT.open(new EvaaMasterPyth({ poolConfig: MAINNET_POOL_CONFIG, debug: true }));
    const WALLET_SENDER = {
        address: WALLET_CONTRACT.address,
        send: WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey).send,
    };

    // const amount = 1_000_000_000n;

    // await EVAA_MAINNET.sendSupply(WALLET_SENDER, amount, {
    //     queryID: 0n,
    //     includeUserCode: true,
    //     amount: 500_000_000n,
    //     userAddress: WALLET_CONTRACT.address,
    //     asset: TON_TESTNET,
    //     payload: Cell.EMPTY,
    //     customPayloadRecipient: WALLET_CONTRACT.address,
    //     subaccountId: 0,
    //     customPayloadSaturationFlag: false,
    //     returnRepayRemainingsFlag: false,
    // });

    const pythCollector = MAINNET_POOL_CONFIG.oracles;

    await EVAA_MAINNET.getSync();

    const prices = await pythCollector.getPrices(MAINNET_POOL_CONFIG.poolAssetsConfig);

    // console.log((tonPythPrice! * BigInt(10 ** 9)) / tonExpo);

    console.log(prices.dict);

    // await EVAA_MAINNET.sendWithdraw(WALLET_SENDER, toNano('1'), {
    //     queryID: 0n,ещт
    //     includeUserCode: true,
    //     // supplyAmount: 0n,
    //     // supplyAsset: TON_TESTNET,
    //     amount: 100_000n,
    //     asset: USDE_MAINNET,
    //     // withdrawRecipient: WALLET_CONTRACT.address,
    //     userAddress: WALLET_CONTRACT.address,
    //     amountToTransfer: 0n,
    //     subaccountId: 0,
    //     payload: Cell.EMPTY,
    //     customPayloadSaturationFlag: false,
    //     returnRepayRemainingsFlag: false,
    //     pyth: {
    //         priceData: prices.dataCell,
    //         maxPublishTime: prices.maxPublishTime!,
    //         minPublishTime: prices.minPublishTime!,
    //         // attachedValue: toNano('0.3'),
    //         pythAddress: PYTH_ORACLE_MAINNET,
    //         targetFeeds: [PYTH_TON_PRICE_FEED_ID, PYTH_USDT_PRICE_FEED_ID, PYTH_USDE_PRICE_FEED_ID],
    //     },
    //     requestedRefTokens: [],
    // });

    console.log('Withdraw sent');
}

withdrawTON();
