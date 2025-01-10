import {AssetConfig, calculatePresentValue, createAssetConfig, Evaa, EVAA_MASTER_MAINNET, EvaaUser, FEES, getPrices, getTonConnectSender, JUSDC_MAINNET, JUSDT_MAINNET, JUSDT_TESTNET, PoolAssetConfig, PoolConfig, PriceData, STTON_TESTNET, TESTNET_POOL_CONFIG, TON_MAINNET, TON_STORM_MAINNET, TON_TESTNET, TONUSDT_DEDUST_MAINNET, USDT_MAINNET, USDT_STORM_MAINNET, UserData, UserDataActive} from '../src';
import {Address, beginCell, Cell, CellType, Dictionary, OpenedContract, Sender, toNano, TonClient, WalletContractV4, WalletContractV5Beta, WalletContractV5R1} from '@ton/ton';
import dotenv from 'dotenv';
import { mnemonicToWalletKey } from '@ton/crypto';
import { MAINNET_LP_POOL_CONFIG, MAINNET_POOL_CONFIG } from '../src/constants/pools';
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { exit } from 'process';

let client: TonClient;
let clientMainNet: TonClient;
let evaa: OpenedContract<Evaa>;
let evaaMainNet: OpenedContract<Evaa>;
let sender: Sender;
let sender_mainnet: Sender;
let sender2: Sender;
let sender2_mainnet: Sender;
let sender3: Sender;
let priceData: PriceData;
let priceDataLP: PriceData;
const address: Address = Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address;
const address_mainnet: Address = Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address;
const address2: Address = Address.parseFriendly('0QAq-I1fRZcegpp2bDALewjsXfdYRnYqE7KMA8DIi98EQLBd').address;
const address2_mainnet: Address = Address.parseFriendly('0QAq-I1fRZcegpp2bDALewjsXfdYRnYqE7KMA8DIi98EQLBd').address;
const address3: Address = Address.parseFriendly('0QA5MjZwkAgDtp6eIb8FqQbaRH1IuYTYbOF6AVfzFSRafas1').address;
//const address4: Address = Address.parseFriendly('UQB0jkvgow2xvEA5JS37-x7NkZYsB9TUEYD43cdQwJt0B9J5').address;
//const address4: Address = Address.parseFriendly('UQC6oolqwFm36Tis31Pk5i6EGsblu8PyhVLB-IX1xU9pryd5').address;
const liquidateAddr: Address = Address.parseFriendly('EQCd_evQcWHlAgZWdmaWiMbIyR4dHvTcevGiRwyL17Yh79xZ').address;

beforeAll(async () => {
    dotenv.config();
    //const endpoint = await getHttpEndpoint(); 
    client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
    clientMainNet = new TonClient({
        //endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        endpoint: 'https://rpc.evaa.finance/api/v2/jsonRPC',
        //apiKey: process.env.RPC_API_KEY_MAINNET,
        apiKey: 'front-test-qdGscsEfza9YEjHK',
        
    });
    let keyPair = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC!.split(' '));
    let keyPair2 = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC_2!.split(' '));
    let keyPair3 = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC_3!.split(' '));
    //let keyPair4 = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC_4!.split(' '));
    let wallet = client.open(
        WalletContractV5R1.create({
            workChain: 0,
            publicKey: keyPair.publicKey,
        }),
    );
    let walletMainNet = clientMainNet.open(
        WalletContractV5R1.create({
            workChain: 0,
            publicKey: keyPair.publicKey,
        }),
    );
    let wallet2 = client.open(
        WalletContractV5R1.create({
            workChain: 0,
            publicKey: keyPair2.publicKey,
        }),
    );
    let wallet2MainNet = clientMainNet.open(
        WalletContractV5R1.create({
            workChain: 0,
            publicKey: keyPair2.publicKey,
        }),
    );
    let wallet3 = client.open(
        WalletContractV5R1.create({
            workChain: 0,
            publicKey: keyPair3.publicKey,
        }),
    );
    /*let wallet4 = client.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair4.publicKey,
        }),
    );*/
    /*let contract = clientMainNet.open(walletMainNet);
    console.log(await contract.getBalance());
    contract = client.open(wallet);
    console.log(await contract.getBalance());

    exit(0);*/
    
    evaa = client.open(new Evaa({poolConfig: TESTNET_POOL_CONFIG}));
    evaaMainNet = clientMainNet.open(new Evaa({poolConfig: MAINNET_POOL_CONFIG}));
    sender = {
        address: address,
        send: wallet.sender(keyPair.secretKey).send
    };
    sender2 = {
        address: address2,
        send: wallet2.sender(keyPair2.secretKey).send
    };
    sender3 = {
        address: address3,
        send: wallet3.sender(keyPair3.secretKey).send
    };
    sender_mainnet = {
        address: address_mainnet,
        send: walletMainNet.sender(keyPair.secretKey).send
    };
    sender2_mainnet = {
        address: address2_mainnet,
        send: wallet2MainNet.sender(keyPair2.secretKey).send
    };
    priceData = await evaa.getPrices();
    priceDataLP = await evaaMainNet.getPrices();
});

async function waitForPrincipalChange(addr: Address, asset: PoolAssetConfig, fun: any, currentEvaa = evaa, currentClient = client):Promise<{ principal: bigint, data: UserDataActive }> {
    let prevPrincipal = 0n;
    let user = currentClient.open(await currentEvaa.openUserContract(addr));
    await user.getSync(currentEvaa.data!.assetsData, currentEvaa.data!.assetsConfig, priceData.dict);

    if (user.data?.type == "active") {
        prevPrincipal = user.data.principals.get(asset.assetId) ?? 0n;
    }

    await new Promise( resolve => setTimeout(resolve, 1000) );

    await fun();

    while (true) {
        user = currentClient.open(await currentEvaa.openUserContract(addr));
        await user.getSync(currentEvaa.data!.assetsData, currentEvaa.data!.assetsConfig, priceData.dict);
        if (user.data?.type == "active") {
            const principalNow: bigint = user.data.principals.get(asset.assetId) ?? 0n;
            if (Math.abs(Number(principalNow - prevPrincipal)) > 10) {
                return {principal: principalNow, data: user.data};
            }
        }
        await new Promise( resolve => setTimeout(resolve, 4000) );
    }
}
// todo test sb rate change test ton liqui
/*
test('Get user info test', async () => {

    let currentEvaa = evaaMainNet;
    let currentClient = clientMainNet;
    let currentPrices = priceDataLP;
    await currentEvaa.getSync();
    
    //console.log(currentEvaa.data?.assetsConfig);
    //let user = client.open(    currentEvaaUser.createFromAddress(Address.parseFriendly('kQCZ49e6RPFC4GLnehZ4es1H_xkXT_oyAZMrEt-u7mBN4p4L').address)
    //)//    await currentEvaa.openUserContract(liquidateAddr));*
    let user = currentClient.open(await currentEvaa.openUserContract(address_mainnet));
    //console.log(currentPrices.dict);
    console.log(currentEvaa.data!.assetsConfig);
    await user.getSync(currentEvaa.data!.assetsData, currentEvaa.data!.assetsConfig, currentPrices.dict);
    console.log('userscaddr', user.address);
    //console.log(currentEvaa.data?.assetsConfig);
    if (user.data?.type != "active") {
        console.log("inactive", user.data?.type);
    } else {
        console.log(user.data.principals.get(TON_MAINNET.assetId)!);
        console.log('principals', user.data.principals);
        console.log('liquidata', user.data.liquidationData)
    }
})
/*

test('Just supply testnet', async () => {
    await evaa.getSync();

    try{
        await waitForPrincipalChange(address, JUSDT_TESTNET, async () => {
            await evaa.sendSupply(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: 100_000n,
                userAddress: address,
                asset: JUSDT_TESTNET,
                payload: Cell.EMPTY,
                amountToTransfer: 0n
            });
        });//, evaaMainNet, clientMainNet);
    }
    catch(e) {
        console.log(e);
    }
})

test('Just supply mainnet', async () => {
    await evaaMainNet.getSync();

    try{
        await waitForPrincipalChange(address_mainnet, TON_MAINNET, async () => {
            await evaaMainNet.sendSupply(sender_mainnet, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: 50_000n,
                userAddress: address_mainnet,
                asset: JUSDT_MAINNET,
                amountToTransfer: toNano(0),
                payload: Cell.EMPTY
            });
        }, evaaMainNet, clientMainNet);
    }
    catch(e) {
        console.log(e);
    }
})*/

/*test('Just withdraw', async () => {
    console.log(priceData.dict);
    await evaaMainNet.getSync();

    const pricesCollector = await evaaMainNet.createPriceCollector();

    const user = clientMainNet.open(await evaaMainNet.openUserContract(address_mainnet));
    await user.getSync(evaaMainNet.data!.assetsData, evaaMainNet.data!.assetsConfig, (await pricesCollector.getPrices()).dict);
    console.log(user.liteData?.principals)
    const currentWithdrawPrices = await pricesCollector.getPricesForWithdraw(user.liteData?.principals!, TON_MAINNET);
    console.log('currentWithdrawPrices', currentWithdrawPrices.dict)
    await evaaMainNet.sendWithdraw(sender_mainnet, toNano(0.7), {
        queryID: 0n,
        includeUserCode: true,
        amount: 200_000n,
        userAddress: address,
        asset: USDT_MAINNET,
        priceData: currentWithdrawPrices.dataCell,
        amountToTransfer: toNano(0),
        payload: Cell.EMPTY
    });
})*/

/*test('Liquidate test', async () => {
    await evaa.getSync();
    priceData = await evaa.getPrices();

    let user = client.open(await evaa.openUserContract(liquidateAddr));
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData.dict);

    
    if (user.data?.type != "active" || !user.isLiquidable) {
        console.log('userInactive')
        return;
    }

    await evaa.sendLiquidation(sender, toNano(1), {
        queryID: 0n,
        includeUserCode: true,
        forwardAmount: FEES.LIQUIDATION_JETTON_FWD,
        liquidatorAddress: address,
        ...user.liquidationParameters!,
        priceData: priceData.dataCell,
        responseAddress: address,
    });
})

test('Supply/withdraw all test', async () => {
    expect.assertions(1);
    await evaa.getSync();

    await waitForPrincipalChange(address, STTON_TESTNET, async () => {
        await evaa.sendSupply(sender, toNano(2), {
            queryID: 0n,
            includeUserCode: true,
            amount: 2_000_000n,
            forwardAmount: 1_000_000_000n,
            userAddress: address,
            asset: STTON_TESTNET,
            amountToTransfer: toNano(0),
            payload: Cell.EMPTY
        });
    });

    let changes = await waitForPrincipalChange(address, TON_TESTNET,
        async() => {
            await evaa.sendWithdraw(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: 0xFFFFFFFFFFFFFFFFn,
                userAddress: address,
                asset: TON_TESTNET,
                priceData: Cell.EMPTY,
                amountToTransfer: toNano(0),
                payload: Cell.EMPTY
            });
        }
    );
    

    await expect(changes.principal).toEqual(0n);
})

test('SupplyBorrowRepayMaxWithdrawMax test', async () => {
    expect.assertions(2);
    await evaa.getSync();

    await waitForPrincipalChange(address, TON_TESTNET, async () => {
        await evaa.sendSupply(sender, toNano(2), {
            queryID: 0n,
            includeUserCode: true,
            amount: 1_000_000_000n,
            userAddress: address,
            asset: TON_TESTNET,
            amountToTransfer: toNano(0),
            payload: Cell.EMPTY
        });
    });

    priceData = await evaa.getPrices();

    let changes = await waitForPrincipalChange(address, JUSDT_TESTNET,
        async() => {
            await evaa.sendWithdraw(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: 0xFFFFFFFFFFFFFFFFn,
                userAddress: address,
                asset: JUSDT_TESTNET,
                priceData: priceData.dataCell,
                amountToTransfer: toNano(0),
                payload: Cell.EMPTY
            });
        }
    );

    //console.log('bal', changes.data.balances.get(JUSDT_TESTNET)!.amount);
    let amoundToRepay = changes.data.balances.get(JUSDT_TESTNET.assetId)!.amount;
    console.log('amount to repay', amoundToRepay);
    changes = await waitForPrincipalChange(address, JUSDT_TESTNET,
        async() => {
            await evaa.sendSupply(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: amoundToRepay,
                userAddress: address,
                asset: JUSDT_TESTNET,
                amountToTransfer: toNano(0),
                payload: Cell.EMPTY,
            });
        }
    );

    await expect(changes.principal).toEqual(0n);

    changes = await waitForPrincipalChange(address, TON_MAINNET,
        async() => {
            await evaa.sendWithdraw(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: 0xFFFFFFFFFFFFFFFFn,
                userAddress: address,
                asset: TON_TESTNET,
                priceData: Cell.EMPTY,
                amountToTransfer: toNano(0),
                payload: Cell.EMPTY
            });
        }
    );

    await expect(changes.principal).toEqual(0n);
})

test('Withdraw test', async () => {
    //const user = client.open(await evaa.openUserContract(address));
    
    await evaa.getSync();

    await evaa.sendWithdraw(sender2, toNano(1), {
        queryID: 0n,
        includeUserCode: true,
        amount: 20_000n,
        userAddress: address2,
        asset: STTON_TESTNET,
        priceData: priceData.dataCell!,
        amountToTransfer: toNano(0),
        payload: Cell.EMPTY
    });
    /*await evaa.sendWithdraw(sender, toNano(1), {
        queryID: 0n,
        includeUserCode: true,
        amount: 100_000_000n, //toNano(0.00001),
        amountToTransfer: toNano(0),
        userAddress: Address.parseFriendly("0QDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWCdG").address,
        assetID: JUSDT_TESTNET,
        payload: Cell.EMPTY,
        priceData: Cell.EMPTY // priceData?.dataCell!,
    });*/
    /*await evaa.sendSupply(sender, toNano(1), {
        queryID: 0n,
        includeUserCode: true,
        amount: 2_000_000_000n, //toNano(0.00001),
        amountToTransfer: toNano(0),
        userAddress: Address.parseFriendly("0QDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWCdG").address,
        assetID: JUSDT_TESTNET,
        type: 'jetton',
        payload: Cell.EMPTY
    });*/
    /*await evaa.sendSupply(wallet.sender(keyPair.secretKey), toNano(2.1) + FEES.SUPPLY, {
        queryID: 0n,
        includeUserCode: true,
        amount: toNano(2.1),
        amountToTransfer: toNano(0),
        userAddress: Address.parseFriendly("0QDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWCdG").address,
        assetID: TESTNET_ASSETS_ID.TON,
        type: 'ton',
        payload: Cell.EMPTY
    });*/
    /*await evaa.sendSupply(wallet.sender(keyPair.secretKey), toNano(10) + FEES.SUPPLY, {
        queryID: 0n,
        includeUserCode: true,
        amount: toNano(10),
        amountToTransfer: toNano(0),
        userAddress: Address.parseFriendly("0QAq-I1fRZcegpp2bDALewjsXfdYRnYqE7KMA8DIi98EQLBd").address,
        assetID: TESTNET_ASSETS_ID.TON,
        type: 'ton',
        payload: Cell.EMPTY
    });
    
    //console.log(lastSentBoc);
    //console.log(
    //    `https://testnet.tonviewer.com/transaction/${Cell.fromBase64(lastSentBoc!.boc).hash().toString('hex')}`,
    //);
}, 6 * 60 * 1000); */