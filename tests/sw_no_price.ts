import 'dotenv/config';

import { HexString } from '@pythnetwork/hermes-client';
import { mnemonicToWalletKey } from '@ton/crypto';
import { Dictionary, TonClient, WalletContractV5R1 } from '@ton/ton';
import {
    ASSET_ID,
    DefaultPythPriceSourcesConfig,
    EvaaMasterPyth,
    FEED_ID,
    FeedMapItem,
    MAINNET_POOL_CONFIG,
    PYTH_ORACLE_MAINNET,
    PythCollector,
    PythOracle,
    TON_MAINNET,
    USDE_MAINNET,
} from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://rpc.evaa.space/api/v2/jsonRPC',
    apiKey: process.env.EVAA_RPC_KEY,
});

async function withdrawTON() {
    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC2!.split(' '));

    const WALLET_CONTRACT = TON_CLIENT.open(
        WalletContractV5R1.create({
            workChain: 0,
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

    const EVAA_USER_MAINNET = TON_CLIENT.open(EVAA_MAINNET.openUserContract(WALLET_CONTRACT.address, 0));

    await EVAA_MAINNET.getSync();

    if (!EVAA_MAINNET.data?.assetsData || !EVAA_MAINNET.data?.assetsConfig) {
        throw new Error('Assets data or config is not available');
    }

    await EVAA_USER_MAINNET.getSyncLite(EVAA_MAINNET.data?.assetsData, EVAA_MAINNET.data?.assetsConfig);

    const userLiteData = EVAA_USER_MAINNET.liteData;
    console.log('userLiteData');
    console.dir(userLiteData?.realPrincipals);

    const pythCollector = new PythCollector({
        pythConfig: DefaultPythPriceSourcesConfig,
        poolAssetsConfig: MAINNET_POOL_CONFIG.poolAssetsConfig,
        pythOracle: {
            feedsMap: new Map<HexString, FeedMapItem>([
                [FEED_ID.TON, { assetId: ASSET_ID.TON, feedId: '0x0' }],
                [FEED_ID.USDT, { assetId: ASSET_ID.USDT, feedId: '0x0' }],
                [FEED_ID.tsTON, { assetId: ASSET_ID.tsTON, feedId: FEED_ID.TON }],
                [FEED_ID.tsUSDe, { assetId: ASSET_ID.tsUSDe, feedId: FEED_ID.USDT }],
            ]),
            pythAddress: PYTH_ORACLE_MAINNET,
            allowedRefTokens: Dictionary.empty<bigint, bigint>()
                .set(ASSET_ID.jUSDT, ASSET_ID.USDT)
                .set(ASSET_ID.jUSDC, ASSET_ID.USDT)
                .set(ASSET_ID.USDe, ASSET_ID.USDT)
                .set(ASSET_ID.stTON, ASSET_ID.tsTON),
        },
    });

    await EVAA_MAINNET.getSync();

    const prices = await pythCollector.getPricesForSupplyWithdraw(
        userLiteData?.realPrincipals!,
        TON_MAINNET,
        USDE_MAINNET,
        false,
    );

    // const prices = await pythCollector.getPrices();

    const targetFeeds = prices.targetFeeds();
    const refAssets = prices.refAssets();
    const binaryUpdate = prices.binaryUpdate();

    const pythOracle = TON_CLIENT.open(new PythOracle(PYTH_ORACLE_MAINNET));
    const pythFee = await pythOracle.getUpdateFee(binaryUpdate);

    console.dir({
        targetFeeds,
        refAssets,
        pythFee,
        binaryUpdate,
    });

    for (const dictKey of prices.dict.keys()) {
        console.log(`${dictKey.toString()}: ${prices.dict.get(dictKey)}`);
    }

    // await EVAA_MAINNET.sendSupply(WALLET_SENDER, amount + FEES.SUPPLY, {
    //     queryID: 0n,
    //     includeUserCode: true,
    //     amount,
    //     userAddress: WALLET_CONTRACT.address,
    //     asset: TON_MAINNET,
    //     payload: Cell.EMPTY,
    //     customPayloadRecipient: WALLET_CONTRACT.address,
    //     subaccountId: 0,
    //     customPayloadSaturationFlag: false,
    //     returnRepayRemainingsFlag: false,
    // });

    // const swNoPrice = EVAA_MAINNET.createSupplyWithdrawMessage({
    //     queryID: 0n,
    //     includeUserCode: true,

    //     supplyAmount: 0n,
    //     supplyAsset: TON_MAINNET,
    //     withdrawAmount: toNano('0.1'),
    //     withdrawAsset: TON_MAINNET,

    //     withdrawRecipient: WALLET_CONTRACT.address,

    //     // amount: toNano('0.1'),

    //     // asset: TON_MAINNET,
    //     // withdrawRecipient: WALLET_CONTRACT.address,
    //     // userAddress: WALLET_CONTRACT.address,
    //     // amountToTransfer: 0n,
    //     subaccountId: 0,
    //     payload: Cell.EMPTY,
    //     customPayloadSaturationFlag: false,
    //     returnRepayRemainingsFlag: false,
    // });

    // await WALLET_SENDER.send({
    //     to: MAINNET_POOL_CONFIG.masterAddress,
    //     value: FEES.SUPPLY_WITHDRAW,
    //     // sendMode: SendMode.PAY_GAS_SEPARATELY,
    //     body: swNoPrice,
    // });

    // await EVAA_MAINNET.sendWithdraw(WALLET_SENDER, FEES.SUPPLY_WITHDRAW + FEES.JETTON_FWD + pythFee, {
    //     queryID: 0n,
    //     includeUserCode: true,
    //     // supplyAmount: 0n,
    //     // supplyAsset: TON_TESTNET,
    //     amount: 100_000n,
    //     asset: USDT_MAINNET,
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
    //         targetFeeds,
    //         refAssets,
    //     },
    // });

    console.log('SW no price sent');
}

withdrawTON();
