import 'dotenv/config';

import { mnemonicToWalletKey } from '@ton/crypto';
import { Address, beginCell, toNano, TonClient, WalletContractV4 } from '@ton/ton';
import {
    calculateHealthParams,
    calculateLiquidationAmounts,
    ClassicCollector,
    EvaaMasterClassic,
    getUserJettonWallet,
    JettonWallet,
    MAINNET_LP_POOL_CONFIG,
    ORACLES_LP,
    TON_MAINNET,
    USDT_MAINNET,
} from '../src';

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

async function liquidateJetton() {
    const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC!.split(' '));

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

    const EVAA_MAINNET = TON_CLIENT.open(new EvaaMasterClassic({ poolConfig: MAINNET_LP_POOL_CONFIG, debug: true }));
    const WALLET_SENDER = {
        address: WALLET_CONTRACT.address,
        send: WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey).send,
    };

    // const amount = 800_000_000n;

    // const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC!.split(' '));

    // const WALLET_CONTRACT = TON_CLIENT.open(
    //     WalletContractV4.create({
    //         workchain: 0,
    //         publicKey: WALLET_KEY_PAIR.publicKey,
    //     }),
    // );

    await EVAA_MAINNET.getSync();

    const borrowerAddress = Address.parse('borrowaddress');

    const EVAA_USER_MAINNET = TON_CLIENT.open(EVAA_MAINNET.openUserContract(borrowerAddress, 0));

    if (!EVAA_MAINNET.data?.assetsData || !EVAA_MAINNET.data?.assetsConfig) {
        throw new Error('Assets data or config is not available');
    }

    await EVAA_USER_MAINNET.getSyncLite(EVAA_MAINNET.data?.assetsData, EVAA_MAINNET.data?.assetsConfig);

    if (!EVAA_USER_MAINNET.liteData?.realPrincipals) {
        throw new Error('Real principals is not available');
    }

    // const pc = await MAINNET_LP_POOL_CONFIG.oracles.getPricesForLiquidate(EVAA_USER_MAINNET.liteData?.realPrincipals);

    const collector = new ClassicCollector({
        poolAssetsConfig: MAINNET_LP_POOL_CONFIG.poolAssetsConfig,
        minimalOracles: 3,
        evaaOracles: ORACLES_LP,
    });

    const twapAssets = MAINNET_LP_POOL_CONFIG.poolAssetsConfig.map((asset) => ({
        name: asset.name,
        assetId: asset.assetId - 1n,
        jettonMasterAddress: asset.jettonMasterAddress,
        jettonWalletCode: asset.jettonWalletCode,
    }));

    const classicPC = await collector.getPrices();
    const twapPC = await collector.getPrices(twapAssets);

    console.log(`${twapPC.dict.keys()}`);

    for (const asset of MAINNET_LP_POOL_CONFIG.poolAssetsConfig) {
        const price = twapPC.getAssetPrice(asset.assetId - 1n);

        console.log(`[TWAP PRICE] ${asset.name}: ${price}`);
    }

    for (const assetId of EVAA_USER_MAINNET.liteData?.realPrincipals.keys()) {
        console.log(`[LIQ PRICE] ${twapPC.dict.get(assetId - 1n)}`);
    }

    // const pc = new ClassicCollector({
    //     poolAssetsConfig: MAINNET_LP_POOL_CONFIG.poolAssetsConfig,
    //     minimalOracles: 3,
    //     evaaOracles: ORACLES_MAINNET,
    // });

    // console.log('userLiteData');
    // console.dir(EVAA_USER_MAINNET.liteData?.balances);

    const health = calculateHealthParams({
        assetsData: EVAA_MAINNET.data.assetsData,
        assetsConfig: EVAA_MAINNET.data.assetsConfig,
        principals: EVAA_USER_MAINNET.liteData!.principals,
        prices: classicPC.dict,
        poolConfig: MAINNET_LP_POOL_CONFIG,
    });

    const loanAsset = USDT_MAINNET;
    const collateralAsset = TON_MAINNET;

    // const loanAssetCollateralFactor = EVAA_MAINNET.data.assetsConfig.get(loanAsset.assetId)?.collateralFactor;

    const { maxCollateralRewardAmount, maxLiquidationAmount } = calculateLiquidationAmounts(
        loanAsset,
        collateralAsset,
        health.totalSupply,
        health.totalDebt,
        EVAA_USER_MAINNET.liteData!.principals,
        classicPC.dict,
        EVAA_MAINNET.data.assetsData,
        EVAA_MAINNET.data.assetsConfig,
        MAINNET_LP_POOL_CONFIG.masterConstants,
    );

    // console.dir({
    //     maxLiquidationAmount,
    //     maxCollateralRewardAmount,
    // });

    const minCollateralAmount = (maxCollateralRewardAmount * 97n) / 100n - 1500000n;

    const liqMessage = EVAA_MAINNET.createLiquidationMessage({
        asset: loanAsset,
        borrowerAddress: borrowerAddress,
        collateralAsset: collateralAsset.assetId, // fix it to right
        queryID: 0n,
        includeUserCode: true,
        liquidationAmount: maxLiquidationAmount,
        liquidatorAddress: WALLET_CONTRACT.address,
        loanAsset: loanAsset.assetId,
        minCollateralAmount,
        payload: beginCell().endCell(),
        customPayloadSaturationFlag: false,
        customPayloadRecipient: WALLET_CONTRACT.address,
        subaccountId: 0,
        priceData: twapPC.dataCell,
    });

    const jettonWallet = TON_CLIENT.open(
        JettonWallet.createFromAddress(getUserJettonWallet(WALLET_CONTRACT.address, loanAsset)),
    );
    await jettonWallet.sendTransfer(WALLET_SENDER, toNano(1), liqMessage);

    console.log('Liquidation sent');
}

liquidateJetton();
