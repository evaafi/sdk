import { configDotenv } from 'dotenv';
import { mnemonicToWalletKey } from '@ton/crypto';
import { Cell, TonClient, WalletContractV4 } from '@ton/ton';
import { Evaa, FEES, getPrices, MAINNET_LP_POOL_CONFIG, PricesCollector, TESTNET_POOL_CONFIG, TON_MAINNET, TONUSDT_DEDUST_MAINNET } from '@evaafi/sdk';

async function main() {
    configDotenv();
    const keyPair = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC!.split(' '));
    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
    const evaa = client.open(
        new Evaa({poolConfig: TESTNET_POOL_CONFIG}),
    );
    const wallet = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey,
        }),
    );
    await evaa.getSync();
    const pricesCollector = new PricesCollector(TESTNET_POOL_CONFIG);
    const priceData = await pricesCollector.getPrices();

    // get user contract that already opened by same client
    // alternative: openUserContract method, which return only instance of user contract without opening
    const user = evaa.getOpenedUserContract(wallet.address);
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);

    if (user.isLiquidable) {
        const liquidationPrices = await pricesCollector.getPricesForLiquidate(user.liteData?.principals!);
        const liquidationData = user.liquidationParameters!;
        // if user code version is outdated, includeUserCode should be true for upgrade this contract
        const includeUserCode = evaa.data!.upgradeConfig.userCodeVersion !== user.liteData!.codeVersion;
        if (liquidationData.tonLiquidation) {
            await evaa.sendLiquidation(wallet.sender(keyPair.secretKey), FEES.LIQUIDATION, {
                queryID: 0n,
                liquidatorAddress: wallet.address,
                includeUserCode: includeUserCode,
                priceData: liquidationPrices.dataCell,
                ...liquidationData,
                forwardAmount: FEES.LIQUIDATION_JETTON_FWD,
                payload: Cell.EMPTY,
                asset: TON_MAINNET,
                responseAddress: wallet.address,
                payloadForwardAmount: 0n,
            });
        } else {
            await evaa.sendLiquidation(wallet.sender(keyPair.secretKey), FEES.LIQUIDATION_JETTON, {
                queryID: 0n,
                liquidatorAddress: wallet.address,
                includeUserCode: includeUserCode,
                priceData: priceData!.dataCell,
                ...liquidationData,
                responseAddress: wallet.address,
                forwardAmount: FEES.LIQUIDATION_JETTON_FWD,
                payload: Cell.EMPTY,
                asset: TON_MAINNET,
                payloadForwardAmount: 0n,
            });
        }
    }
}

main();
