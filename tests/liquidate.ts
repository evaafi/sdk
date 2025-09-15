import 'dotenv/config';

import { mnemonicToWalletKey } from '@ton/crypto';
import { Address, beginCell, toNano, TonClient, WalletContractV4 } from '@ton/ton';
import {
    calculateHealthParams,
    calculateLiquidationAmounts,
    EvaaMasterPyth,
    getUserJettonWallet,
    JettonWallet,
    JUSDC_MAINNET,
    JUSDT_MAINNET,
    MAINNET_POOL_CONFIG,
    PYTH_ORACLE_MAINNET,
    STTON_MAINNET,
    TSTON_MAINNET,
    USDE_MAINNET,
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

    const EVAA_MAINNET = TON_CLIENT.open(new EvaaMasterPyth({ poolConfig: MAINNET_POOL_CONFIG, debug: true }));
    const WALLET_SENDER = {
        address: WALLET_CONTRACT.address,
        send: WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey).send,
    };

    const amount = 800_000_000n;

    // const WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.MAINNET_WALLET_MNEMONIC!.split(' '));

    // const WALLET_CONTRACT = TON_CLIENT.open(
    //     WalletContractV4.create({
    //         workchain: 0,
    //         publicKey: WALLET_KEY_PAIR.publicKey,
    //     }),
    // );

    await EVAA_MAINNET.getSync();

    const EVAA_USER_MAINNET = TON_CLIENT.open(EVAA_MAINNET.openUserContract(Address.parse('borroweraddress'), 0));

    if (!EVAA_MAINNET.data?.assetsData || !EVAA_MAINNET.data?.assetsConfig) {
        throw new Error('Assets data or config is not available');
    }

    await EVAA_USER_MAINNET.getSyncLite(EVAA_MAINNET.data?.assetsData, EVAA_MAINNET.data?.assetsConfig);

    const pc = await MAINNET_POOL_CONFIG.oracles.getPrices(MAINNET_POOL_CONFIG.poolAssetsConfig);

    console.dir(pc.getAssetPrice(TSTON_MAINNET.assetId));

    // console.log('userLiteData');
    // console.dir(EVAA_USER_MAINNET.liteData?.balances);

    const health = calculateHealthParams({
        assetsData: EVAA_MAINNET.data.assetsData,
        assetsConfig: EVAA_MAINNET.data.assetsConfig,
        principals: EVAA_USER_MAINNET.liteData!.principals,
        prices: pc.dict,
        poolConfig: MAINNET_POOL_CONFIG,
    });

    const loanAsset = TSTON_MAINNET;
    const collateralAsset = STTON_MAINNET;

    // const loanAssetCollateralFactor = EVAA_MAINNET.data.assetsConfig.get(loanAsset.assetId)?.collateralFactor;

    const { maxCollateralRewardAmount, maxLiquidationAmount } = calculateLiquidationAmounts(
        loanAsset,
        collateralAsset,
        health.totalSupply,
        health.totalDebt,
        EVAA_USER_MAINNET.liteData!.principals,
        pc.dict,
        EVAA_MAINNET.data.assetsData,
        EVAA_MAINNET.data.assetsConfig,
        MAINNET_POOL_CONFIG.masterConstants,
    );

    // console.dir({
    //     maxLiquidationAmount,
    //     maxCollateralRewardAmount,
    // });

    const minCollateralAmount = (maxCollateralRewardAmount * 97n) / 100n - 1500000n;

    const liqMessage = EVAA_MAINNET.createLiquidationMessage({
        asset: loanAsset,
        borrowerAddress: Address.parse('borroweraddress'),
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
        pyth: {
            targetFeeds: [
                '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
                '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
                '0x3d1784128eeab5961ec60648fe497d3901eebd211b7f51e4bb0db9f024977d25',
                '0xcbe184846426619a60f51056d26efecb0537ad3a73b1e965fe695d06a257cb19',
            ],
            pythAddress: PYTH_ORACLE_MAINNET,
            priceData: pc.dataCell,
            publishGap: 10,
            maxStaleness: 180,
            requestedRefTokens: [
                USDE_MAINNET.assetId,
                JUSDT_MAINNET.assetId,
                JUSDC_MAINNET.assetId,
                STTON_MAINNET.assetId,
            ],
        },
    });

    const jettonWallet = TON_CLIENT.open(
        JettonWallet.createFromAddress(getUserJettonWallet(WALLET_CONTRACT.address, loanAsset)),
    );
    await jettonWallet.sendTransfer(WALLET_SENDER, toNano(2), liqMessage);

    console.log('Liquidation sent');
}

liquidateJetton();
