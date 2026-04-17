import 'dotenv/config';

import { mnemonicToWalletKey } from '@ton/crypto';
import { Cell, toNano, TonClient, WalletContractV4 } from '@ton/ton';
import {
    BalanceType,
    ClassicCollector,
    EvaaMasterClassic,
    EvaaUser,
    FEES,
    TESTNET_CLASSIC_HE_POOL_CONFIG,
    TON_MAINNET,
    USDE_MAINNET,
    USDT_MAINNET,
    calculateHealthParams,
    determineHeCategory,
    getAvailableToBorrowWithHeMode,
    presentValue,
} from '../src';

// ==================== Configuration ====================

const POOL_CONFIG = TESTNET_CLASSIC_HE_POOL_CONFIG;

const MAX_WITHDRAW_AMOUNT = 0xffffffffffffffffn;

// Pool assets: TON (HE cat 1), tsTON (HE cat 1), USDT (HE cat 2), USDe (HE cat 2)
// High Efficiency (HE) mode activates when ALL borrowed assets belong to the same HE category (> 0)
// This gives higher collateral factors and liquidation thresholds

const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY_MAINNET,
});

// ==================== Helpers ====================

async function getWallet() {
    const mnemonic = process.env.MAINNET_WALLET_MNEMONIC;
    if (!mnemonic) {
        throw new Error('MAINNET_WALLET_MNEMONIC is not defined in environment variables');
    }
    const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
    const wallet = TON_CLIENT.open(
        WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey,
        }),
    );
    const sender = {
        address: wallet.address,
        send: wallet.sender(keyPair.secretKey).send,
    };
    return { wallet, sender, keyPair };
}

async function getMasterAndPrices() {
    const master = TON_CLIENT.open(new EvaaMasterClassic({ poolConfig: POOL_CONFIG, debug: true }));
    await master.getSync();

    if (!master.data?.assetsData || !master.data?.assetsConfig) {
        throw new Error('Failed to sync master contract data');
    }

    const collector = POOL_CONFIG.collector as ClassicCollector;
    const prices = await collector.getPrices();

    return { master, prices, collector };
}

async function getUserData(
    master: ReturnType<typeof TON_CLIENT.open<EvaaMasterClassic>>,
    walletAddress: any,
    prices: any,
) {
    const userContract = TON_CLIENT.open(master.openUserContract(walletAddress));
    await userContract.getSync(master.data!.assetsData, master.data!.assetsConfig, prices.dict);
    return userContract;
}

function printUserHealth(user: ReturnType<typeof TON_CLIENT.open<EvaaUser>>, master: any, prices: any) {
    if (!user.data || user.data.type === 'inactive') {
        console.log('  User SC is inactive (no positions)');
        return;
    }

    console.dir(user.data.principals);

    const healthParams = calculateHealthParams({
        principals: user.data.principals,
        prices: prices.dict,
        assetsData: master.data!.assetsData,
        assetsConfig: master.data!.assetsConfig,
        poolConfig: POOL_CONFIG,
    });

    const heCategory = determineHeCategory(user.data.principals, master.data!.assetsConfig);

    console.log(`  HE Category: ${heCategory > 0 ? heCategory : 'none (standard mode)'}`);
    console.log(`  Total Supply: ${healthParams.totalSupply}`);
    console.log(`  Total Debt:   ${healthParams.totalDebt}`);
    console.log(`  Total Limit:  ${healthParams.totalLimit}`);
    console.log(`  Liquidatable: ${healthParams.isLiquidatable}`);

    if (healthParams.totalLimit > 0n) {
        const healthFactor = 1 - Number(healthParams.totalDebt) / Number(healthParams.totalLimit);
        console.log(`  Health Factor: ${(healthFactor * 100).toFixed(2)}%`);
    }

    // Show available to borrow with HE
    const { availableToBorrow, heCategory: borrowHeCategory } = getAvailableToBorrowWithHeMode(
        master.data!.assetsConfig,
        master.data!.assetsData,
        user.data.principals,
        prices.dict,
        POOL_CONFIG.masterConstants,
    );
    console.log(`  Available to Borrow: ${availableToBorrow} (HE cat: ${borrowHeCategory})`);

    // Print per-asset balances
    console.log('  Positions:');
    for (const asset of POOL_CONFIG.poolAssetsConfig) {
        const principal = user.data.principals.get(asset.assetId);
        if (principal && principal !== 0n) {
            const assetData = master.data!.assetsData.get(asset.assetId)!;
            const balance = presentValue(assetData.sRate, assetData.bRate, principal, POOL_CONFIG.masterConstants);
            const side = balance.type === BalanceType.supply ? 'SUPPLY' : 'BORROW';
            console.log(`    ${asset.name}: ${balance.amount} (${side})`);
        }
    }
}

// ==================== Supply ====================

/**
 * Supply a jetton asset (USDT, USDe, tsTON) into the HE pool.
 *
 * To activate HE mode, supply correlated assets and borrow within the same category:
 * - Category 1: TON, tsTON (TON derivatives)
 * - Category 2: USDT, USDe (stablecoins)
 */
async function supplyJetton() {
    const { wallet, sender } = await getWallet();
    const { master } = await getMasterAndPrices();

    console.log(`Wallet: ${wallet.address}`);
    console.log(`Balance: ${await wallet.getBalance()}`);

    // --- Supply USDT (HE category 2) ---
    const supplyAsset = USDT_MAINNET;
    const supplyAmount = 100_000n; // 0.1 USDT (6 decimals)

    console.log(`\nSupplying ${supplyAmount} ${supplyAsset.name}...`);

    await master.sendSupply(sender, FEES.SUPPLY_WITHDRAW + FEES.JETTON_FWD, {
        queryID: 0n,
        includeUserCode: true,
        amount: supplyAmount,
        userAddress: wallet.address,
        asset: supplyAsset,
        payload: Cell.EMPTY,
        customPayloadRecipient: wallet.address,
        subaccountId: 0,
        customPayloadSaturationFlag: false,
        returnRepayRemainingsFlag: false,
    });

    console.log(`Supply ${supplyAsset.name} sent!`);
}

/**
 * Supply TON into the HE pool.
 */
async function supplyTON() {
    const { wallet, sender } = await getWallet();
    const { master } = await getMasterAndPrices();

    console.log(`Wallet: ${wallet.address}`);

    const supplyAmount = toNano('1'); // 1 TON

    console.log(`\nSupplying ${supplyAmount} TON...`);

    await master.sendSupply(sender, supplyAmount + FEES.SUPPLY_WITHDRAW, {
        queryID: 0n,
        includeUserCode: true,
        amount: supplyAmount,
        userAddress: wallet.address,
        asset: TON_MAINNET,
        payload: Cell.EMPTY,
        customPayloadRecipient: wallet.address,
        subaccountId: 0,
        customPayloadSaturationFlag: false,
        returnRepayRemainingsFlag: false,
    });

    console.log('Supply TON sent!');
}

// ==================== Withdraw (Borrow) ====================

/**
 * Withdraw/borrow an asset from the HE pool.
 *
 * For withdraw to create a borrow position (and activate HE mode):
 * 1. Supply collateral (e.g. TON, HE cat 1)
 * 2. Withdraw/borrow a correlated asset (e.g. tsTON, HE cat 1) → High Efficiency (HE) mode active
 *    OR withdraw a non-correlated asset (e.g. USDT, HE cat 2) → standard mode
 *
 * With HE mode active, you get higher CF/LT, meaning you can borrow more.
 */
async function withdrawJetton() {
    const { wallet, sender } = await getWallet();
    const { master, prices, collector } = await getMasterAndPrices();

    console.log(`Wallet: ${wallet.address}`);

    // First, get user data to fetch principals for price filtering
    const user = await getUserData(master, wallet.address, prices);

    console.log('\n--- Before Withdraw ---');
    printUserHealth(user, master, prices);

    if (!user.liteData) {
        throw new Error('User has no positions. Supply first.');
    }

    // --- Withdraw USDe (HE category 2, same as USDT) ---
    // If user has only USDE supplied, withdrawing USDe activates HE mode (cat 2)
    // giving ~80% CF instead of ~40%
    const withdrawAsset = USDE_MAINNET;
    const withdrawAmount = 100_000n; // 0.1 USDe (6 decimals)

    // Get TWAP prices required for withdraw with borrow
    const withdrawPrices = await collector.getPricesForWithdraw(
        user.liteData.realPrincipals,
        withdrawAsset,
        true, // collateralToDebt = true (borrowing, not just withdrawing own supply)
    );

    console.log(`\nWithdrawing (borrowing) ${withdrawAmount} ${withdrawAsset.name}...`);

    await master.sendWithdraw(sender, FEES.SUPPLY_WITHDRAW, {
        queryID: 0n,
        includeUserCode: true,
        amount: withdrawAmount,
        asset: withdrawAsset,
        userAddress: wallet.address,
        amountToTransfer: 0n,
        priceData: withdrawPrices.dataCell,
        payload: Cell.EMPTY,
        subaccountId: 0,
        customPayloadSaturationFlag: false,
        returnRepayRemainingsFlag: false,
    });

    console.log(`Withdraw ${withdrawAsset.name} sent!`);
}

/**
 * Withdraw own supply (no borrow created).
 * If user has no debt, no prices needed.
 */
async function withdrawOwnSupply() {
    const { wallet, sender } = await getWallet();
    const { master, prices, collector } = await getMasterAndPrices();

    const user = await getUserData(master, wallet.address, prices);

    console.log('\n--- Before Withdraw ---');
    printUserHealth(user, master, prices);

    if (!user.liteData) {
        throw new Error('User has no positions.');
    }

    const withdrawAsset = USDT_MAINNET;
    const withdrawAmount = MAX_WITHDRAW_AMOUNT; // max withdraw

    // Get prices for withdraw
    const withdrawPrices = await collector.getPricesForWithdraw(
        user.liteData.realPrincipals,
        withdrawAsset,
        false, // not creating debt, just withdrawing own supply
    );

    console.log(`\nWithdrawing max ${withdrawAsset.name}...`);

    await master.sendWithdraw(sender, FEES.SUPPLY_WITHDRAW, {
        queryID: 0n,
        includeUserCode: true,
        amount: withdrawAmount,
        asset: withdrawAsset,
        userAddress: wallet.address,
        amountToTransfer: 0n,
        priceData: withdrawPrices.dataCell,
        payload: Cell.EMPTY,
        subaccountId: 0,
        customPayloadSaturationFlag: false,
        returnRepayRemainingsFlag: false,
    });

    console.log(`Withdraw ${withdrawAsset.name} sent!`);
}

// ==================== Check User State ====================

async function checkUserState() {
    const { wallet } = await getWallet();
    const { master, prices } = await getMasterAndPrices();

    console.log(`Wallet: ${wallet.address}`);

    const user = await getUserData(master, wallet.address, prices);

    console.log('\n--- User State ---');
    printUserHealth(user, master, prices);
}

// ==================== Main ====================

const command = process.argv[2] || 'check';

switch (command) {
    case 'supply-jetton':
        supplyJetton();
        break;
    case 'supply-ton':
        supplyTON();
        break;
    case 'withdraw-borrow':
        withdrawJetton();
        break;
    case 'withdraw-own':
        withdrawOwnSupply();
        break;
    case 'check':
        checkUserState();
        break;
    default:
        console.log('Usage: npx ts-node tests/supply_withdraw_classic_he.ts <command>');
        console.log('Commands:');
        console.log('  supply-jetton    - Supply USDT into HE pool');
        console.log('  supply-ton       - Supply TON into HE pool');
        console.log('  withdraw-borrow  - Borrow tsTON against TON collateral (HE mode)');
        console.log('  withdraw-own     - Withdraw own USDT supply');
        console.log('  check            - Check current user positions and HE status');
}
