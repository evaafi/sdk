import 'dotenv/config';

import { mnemonicToWalletKey } from '@ton/crypto';
import { Cell, Dictionary, TonClient, WalletContractV5R1 } from '@ton/ton';
import {
    ASSET_ID,
    DefaultPythPriceSourcesConfig,
    EVAA_JUSDT_PRICE_FEED_ID,
    EvaaMasterPyth,
    MAINNET_PYTH_V8_TOB_POOL_ASSETS_CONFIG,
    MAINNET_PYTH_V8_TOB_POOL_CONFIG,
    packConnectedFeeds,
    PYTH_ORACLE_MAINNET,
    PYTH_TON_PRICE_FEED_ID,
    PYTH_USDT_PRICE_FEED_ID,
    PythCollector,
    TON_TESTNET,
} from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNEET,
});

async function withdrawTON() {
    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC!.split(' '));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV5R1.create({
            workChain: 0,
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

    const EVAA_MAINNET = TON_CLIENT.open(
        new EvaaMasterPyth({ poolConfig: MAINNET_PYTH_V8_TOB_POOL_CONFIG, debug: true }),
    );
    const WALLET_SENDER = {
        address: WALLET_CONTRACT.address,
        send: WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey).send,
    };

    const amount = 1_000_000_000n;

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

    const pythCollector = new PythCollector({
        pythConfig: DefaultPythPriceSourcesConfig,
        poolAssetsConfig: MAINNET_PYTH_V8_TOB_POOL_ASSETS_CONFIG,
        pythOracle: {
            feedsMap: Dictionary.empty<bigint, Buffer>()
                .set(BigInt(PYTH_TON_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.TON, 0n))
                .set(BigInt(PYTH_USDT_PRICE_FEED_ID), packConnectedFeeds(ASSET_ID.USDT, 0n)),
            pythAddress: PYTH_ORACLE_MAINNET,
            allowedRefTokens: Dictionary.empty<bigint, bigint>().set(
                BigInt(EVAA_JUSDT_PRICE_FEED_ID),
                BigInt(ASSET_ID.USDT),
            ),
        },
    });

    await EVAA_MAINNET.getSync();

    const prices = await pythCollector.getPrices();

    // console.dir(prices.getAssetPrice(JUSDC_MAINNET.assetId));


    prices.dataCell


    await EVAA_MAINNET.sendWithdraw(WALLET_SENDER, amount, {
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
        pyth: {
            priceData: prices.dataCell,
            maxPublishTime
        },
    });

    console.log('Withdraw sent');
}

withdrawTON();
