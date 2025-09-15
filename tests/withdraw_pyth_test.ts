import 'dotenv/config';

import { mnemonicToWalletKey } from '@ton/crypto';
import { Cell, TonClient, TonClient4, WalletContractV4 } from '@ton/ton';
import {
    EvaaMasterClassic,
    JUSDC_MAINNET,
    JUSDC_TESTNET,
    ORACLES_TESTNET,
    PricesCollector,
    TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED,
    TON_MAINNET,
    TON_TESTNET,
} from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_TESTNET,
});

const TON_CLIENT4 = new TonClient4({
    endpoint: 'https://mainnet-v4.tonhubapi.com',
});

async function withdrawTON() {
    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.TESTNET_WALLET_MNEMONIC3!.split(' '));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: WALLET_KEY_PAIR.publicKey,
        }),
    );

    console.log(WALLET_CONTRACT.address.toString());
    const balance = await WALLET_CONTRACT.getBalance();
    console.log(balance);
    if (balance == 0n) {
        console.log(`Wallet ${WALLET_CONTRACT.address} balance is 0, nothing to do`);
        return;
    }

    const EVAA_TESTNET = TON_CLIENT.open(
        new EvaaMasterClassic({ poolConfig: TESTNET_CLASSIC_POOL_CONFIG_TOB_AUDITED, debug: true }),
    );
    const WALLET_SENDER = {
        address: WALLET_CONTRACT.address,
        send: WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey).send,
    };

    const amount = 1_000_000_000n;

    // await EVAA_TESTNET.sendSupply(WALLET_SENDER, amount, {
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

    const priceCollector = new PricesCollector({
        poolAssetsConfig: [JUSDC_MAINNET, JUSDC_TESTNET, TON_MAINNET],
        minimalOracles: 3,
        evaaOracles: ORACLES_TESTNET,
    });

    await EVAA_TESTNET.getSync();

    const prices = await priceCollector.getPrices();

    // console.dir(prices.getAssetPrice(JUSDC_MAINNET.assetId));

    await EVAA_TESTNET.sendWithdraw(WALLET_SENDER, amount, {
        queryID: 0n,
        includeUserCode: true,
        // supplyAmount: 0n,
        // supplyAsset: TON_TESTNET,
        amount: 500_000_000n,
        asset: TON_TESTNET,
        // withdrawRecipient: WALLET_CONTRACT.address,
        userAddress: WALLET_CONTRACT.address,
        amountToTransfer: 0n,
        subaccountId: 0,
        payload: Cell.EMPTY,
        customPayloadSaturationFlag: false,
        returnRepayRemainingsFlag: false,
        priceData: prices.dataCell,
    });

    console.log('Withdraw sent');
}

withdrawTON();
