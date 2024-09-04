import {AssetConfig, calculatePresentValue, createAssetConfig, Evaa, EVAA_MASTER_MAINNET, EvaaUser, FEES, getPrices, getTonConnectSender, JUSDT_TESTNET, PoolAssetConfig, PoolConfig, PriceData, STTON_TESTNET, TESTNET_POOL_CONFIG, TON_MAINNET, TON_TESTNET, UserData, UserDataActive} from '../src';
import {Address, beginCell, Cell, CellType, Dictionary, OpenedContract, Sender, toNano, TonClient, WalletContractV5Beta, WalletContractV5R1} from '@ton/ton';
import dotenv from 'dotenv';
import { sha256Hash } from '../src/utils/sha256BigInt';
import { KeyPair, mnemonicToWalletKey } from '@ton/crypto';
import { TESTNET_LP_POOL_CONFIG } from '../src/constants/pools';

let client: TonClient;
let evaa: OpenedContract<Evaa>;
let sender: Sender;
let sender2: Sender;
let sender3: Sender;
let priceData: PriceData;
const address: Address = Address.parseFriendly('0QDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWCdG').address;
const address2: Address = Address.parseFriendly('0QAq-I1fRZcegpp2bDALewjsXfdYRnYqE7KMA8DIi98EQLBd').address;
const address3: Address = Address.parseFriendly('0QA5MjZwkAgDtp6eIb8FqQbaRH1IuYTYbOF6AVfzFSRafas1').address;
const liquidateAddr: Address = Address.parseFriendly('EQCd_evQcWHlAgZWdmaWiMbIyR4dHvTcevGiRwyL17Yh79xZ').address;


beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
    let keyPair = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC!.split(' '));
    let keyPair2 = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC_2!.split(' '));
    let keyPair3 = await mnemonicToWalletKey(process.env.WALLET_MNEMONIC_3!.split(' '));
    let wallet = client.open(
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
    let wallet3 = client.open(
        WalletContractV5R1.create({
            workChain: 0,
            publicKey: keyPair3.publicKey,
        }),
    );
    evaa = client.open(new Evaa({poolConfig: TESTNET_LP_POOL_CONFIG}));
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
    priceData = await getPrices();

});

async function waitForPrincipalChange(addr: Address, asset: PoolAssetConfig, fun: any):Promise<{ principal: bigint, data: UserDataActive }> {
    let prevPrincipal = 0n;
    let user = client.open(await evaa.openUserContract(addr));
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData.dict);
    if (user.data?.type == "active") {
        prevPrincipal = user.data.principals.get(asset.assetId) ?? 0n;
    }

    await new Promise( resolve => setTimeout(resolve, 1000) );

    await fun();

    while (true) {
        user = client.open(await evaa.openUserContract(addr));
        await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData.dict);
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

test('Get user info test', async () => {

    await evaa.getSync();
    
    //console.log(evaa.data?.assetsConfig);
    //let user = client.open(    EvaaUser.createFromAddress(Address.parseFriendly('kQCZ49e6RPFC4GLnehZ4es1H_xkXT_oyAZMrEt-u7mBN4p4L').address)
    //)//    await evaa.openUserContract(liquidateAddr));*
    let user = client.open(await evaa.openUserContract(address));
    
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData.dict);
    console.log(evaa.data?.assetsConfig);
    if (user.data?.type != "active") {
        console.log("inactive", user.data?.type);
    } else {
        console.log(user.data.principals.get(JUSDT_TESTNET.assetId)!);
        console.log('principals', user.data.principals);
        console.log('liquidata', user.data.liquidationData)
    }
})

test('Just supply', async () => {
    await evaa.getSync();

    await waitForPrincipalChange(address2, TON_TESTNET, async () => {
        await evaa.sendSupply(sender2, toNano(3), {
            queryID: 0n,
            includeUserCode: true,
            amount: 2_500_000_000n,
            userAddress: address2,
            asset: TON_TESTNET
        });
    });
})

test('Just withdraw max', async () => {
    await evaa.getSync();

    await waitForPrincipalChange(address, TON_TESTNET,
        async() => {
            await evaa.sendWithdraw(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: 0xFFFFFFFFFFFFFFFFn,
                userAddress: address,
                asset: TON_TESTNET,
                priceData: priceData.dataCell
            });
        }
    );
})

/*test('Liquidate test', async () => {
    await evaa.getSync();
    priceData = await getPrices();

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
})*/

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
                priceData: Cell.EMPTY
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
        });
    });

    priceData = await getPrices();

    let changes = await waitForPrincipalChange(address, JUSDT_TESTNET,
        async() => {
            await evaa.sendWithdraw(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: 0xFFFFFFFFFFFFFFFFn,
                userAddress: address,
                asset: JUSDT_TESTNET,
                priceData: priceData.dataCell
            });
        }
    );

    //console.log('bal', changes.data.balances.get(JUSDT_TESTNET)!.amount);
    let amoundToRepay = changes.data.balances.get(JUSDT_TESTNET.assetId)!.amount;
    /*let user = client.open(await evaa.openUserContract(address));
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData.dict);
    if (user.data?.type != "active") {
        return;
    }
    let amoundToRepay = user.data.balances.get(JUSDT_TESTNET)!.amount;*/
    console.log('amount to repay', amoundToRepay);
    changes = await waitForPrincipalChange(address, JUSDT_TESTNET,
        async() => {
            await evaa.sendSupply(sender, toNano(1), {
                queryID: 0n,
                includeUserCode: true,
                amount: amoundToRepay,
                userAddress: address,
                asset: JUSDT_TESTNET,
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
                priceData: Cell.EMPTY
            });
        }
    );

    await expect(changes.principal).toEqual(0n);
})

test('Withdraw test', async () => {
    const user = client.open(await evaa.openUserContract(address));
    const priceData = await getPrices();
    
    await evaa.getSync();

    await evaa.sendWithdraw(sender, toNano(1), {
        queryID: 0n,
        includeUserCode: true,
        amount: toNano(1), //toNano(0.00001),
        userAddress: address,
        asset: TON_TESTNET,
        priceData: priceData?.dataCell!,
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
    });*/
    
    //console.log(lastSentBoc);
    //console.log(
    //    `https://testnet.tonviewer.com/transaction/${Cell.fromBase64(lastSentBoc!.boc).hash().toString('hex')}`,
    //);
    await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);
    console.log(user);
    console.log(evaa.data?.assetsConfig);
    console.log(evaa.data?.assetsData);
    //console.log(priceData!.dict);
    //console.log(evaa.data!.assetsConfig.get(sha256Hash("USDT")));
    return;
}, 6 * 60 * 1000);