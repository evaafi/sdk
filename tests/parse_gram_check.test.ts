import { Address, Cell, TonClient } from '@ton/ton';
import {
    ASSET_ID,
    ASSET_PRICE_SCALE,
    FEED_ID,
    GRAM_MAINNET,
    TON_MAINNET,
    isGramAssetId,
    isTonAssetId,
    isGramAsset,
    EvaaMasterClassic,
    MAINNET_POOL_CONFIG,
    MAINNET_ALTS_POOL_CONFIG,
    OPCODES,
    USDT_MAINNET,
    PoolConfig,
} from '../src';
import { sha256Hash } from '../src/utils/sha256BigInt';

import dotenv from 'dotenv';
dotenv.config();

// Known user with positions on mainnet (reused from existing parse tests)
const USER = Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address;

describe('GRAM rename — sanity checks', () => {
    // --- Pure, offline: proves the on-chain asset id did NOT change ---
    test('asset id is unchanged (GRAM === historical sha256(TON))', () => {
        // Ground-truth pin: the on-chain id MUST be sha256('TON') (historical). Comparing to
        // ASSET_ID.TON alone is a tautology (same literal) — this catches the id silently
        // drifting away from sha256('TON'), which is the core "SC interaction unchanged" guarantee.
        expect(ASSET_ID.GRAM).toEqual(sha256Hash('TON'));
        expect(ASSET_ID.TON).toEqual(ASSET_ID.GRAM); // deprecated alias resolves to the same id
        expect(typeof ASSET_ID.GRAM).toBe('bigint');
        expect(ASSET_ID.GRAM).toBeGreaterThan(0n);

        // Native asset config: renamed display + same id, alias preserved
        expect(GRAM_MAINNET.name).toBe('GRAM');
        expect(GRAM_MAINNET.assetId).toEqual(ASSET_ID.GRAM);
        expect(TON_MAINNET).toBe(GRAM_MAINNET); // alias is the same object

        // Detection helpers (new + deprecated alias) agree
        expect(isGramAssetId(ASSET_ID.GRAM)).toBe(true);
        expect(isTonAssetId(ASSET_ID.GRAM)).toBe(true);
        expect(isGramAsset(GRAM_MAINNET)).toBe(true);
        expect(isGramAsset(USDT_MAINNET)).toBe(false); // a jetton must NOT be detected as native

        // Pyth feed swapped to gram.usd; deprecated alias points to the same value
        expect(FEED_ID.GRAM).toBe('0xe41cd8a90528974c7b97b506abb694e2cc5750b119f796a7001890c1a93a572d');
        expect(FEED_ID.TON).toBe(FEED_ID.GRAM);
    });

    // --- Offline, SC write-path: the rename must not change the bytes we send to the contract ---
    // The most fragile coupling is the native-vs-jetton branch, keyed on asset.name === 'GRAM'
    // (isGramAsset). A native supply must serialize as a plain operation payload starting with the
    // SUPPLY_MASTER opcode; a jetton would instead be a jetton-transfer message.
    test('SC write-path: native (GRAM) supply takes the native branch, not jetton', () => {
        const master = new EvaaMasterClassic({ poolConfig: MAINNET_POOL_CONFIG });
        const supply = master.createSupplyMessage({
            asset: GRAM_MAINNET,
            queryID: 0n,
            includeUserCode: true,
            amount: 1_000_000_000n,
            userAddress: USER,
            payload: Cell.EMPTY,
        });

        // Native branch => first 32 bits are the SUPPLY_MASTER opcode (not a jetton transfer op).
        expect(supply.beginParse().loadUint(32)).toBe(OPCODES.SUPPLY_MASTER);
    });

    // --- Live, read-only: parse a real user's principals across two pools ---
    const client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY_MAINNET,
    });

    const POOLS: { label: string; config: PoolConfig }[] = [
        { label: 'MAIN', config: MAINNET_POOL_CONFIG },
        { label: 'ALTS', config: MAINNET_ALTS_POOL_CONFIG },
    ];

    for (const { label, config } of POOLS) {
        test(`parse user principals — ${label} pool`, async () => {
            const nameById = new Map<bigint, string>(config.poolAssetsConfig.map((a) => [a.assetId, a.name]));
            // native asset (id sha256('TON')) is now labeled GRAM in the pool config
            expect(nameById.get(ASSET_ID.GRAM)).toBe('GRAM');

            const master = client.open(new EvaaMasterClassic({ poolConfig: config }));
            await master.getSync();
            expect(master.data?.assetsData).toBeDefined();
            expect(master.data?.assetsConfig).toBeDefined();

            const user = client.open(master.openUserContract(USER));
            await user.getSyncLite(master.data!.assetsData, master.data!.assetsConfig);

            const lite = user.liteData;
            console.log(`\n=== ${label} pool — user ${USER.toString()} ===`);
            if (!lite) {
                console.log('  (user inactive in this pool)');
                return; // nothing to parse; not a failure
            }

            console.log(`  codeVersion: ${lite.codeVersion}`);
            console.log('  realPrincipals:');
            const unknownIds: string[] = [];
            for (const [assetId, principal] of lite.realPrincipals) {
                const name = nameById.get(assetId);
                const tag = isGramAssetId(assetId) ? '  <- native (was TON)' : '';
                console.log(`    ${(name ?? `unknown(0x${assetId.toString(16)})`).padEnd(10)} ${principal.toString()}${tag}`);
                if (!name) unknownIds.push(`0x${assetId.toString(16)}`);
            }

            // Lite parse integrity: principals parsed, and every id maps to a known
            // asset in the (renamed) pool config — i.e. the GRAM rename didn't orphan any id.
            expect(typeof lite.codeVersion).toBe('number');
            expect(lite.realPrincipals.size).toBeGreaterThan(0);
            expect(unknownIds).toEqual([]);
        }, 120000);
    }
});

describe('GRAM Pyth price — end-to-end via SDK collector', () => {
    test('PythCollector.getPrices() returns a non-zero price for GRAM (gram.usd)', async () => {
        const assets = MAINNET_POOL_CONFIG.poolAssetsConfig;
        const nameById = new Map<bigint, string>(assets.map((a) => [a.assetId, a.name]));

        // The exact collector wired into the main pool (PythCollector -> hermes.pyth.network)
        const prices = await MAINNET_POOL_CONFIG.collector.getPrices(assets);

        const fmt = (v: bigint) => '$' + (Number(v) / Number(ASSET_PRICE_SCALE)).toFixed(6);
        console.log('\n=== MAINNET main pool — Pyth prices (assetId -> USD, scale 1e9) ===');
        for (const a of assets) {
            const p = prices.dict.get(a.assetId);
            const tag = isGramAssetId(a.assetId) ? '  <- native (gram.usd feed)' : '';
            console.log(`  ${a.name.padEnd(10)} ${p === undefined ? 'MISSING' : fmt(p)}${tag}`);
        }
        if (prices.minPublishTime || prices.maxPublishTime) {
            console.log(`  publishTime range: ${prices.minPublishTime} .. ${prices.maxPublishTime}`);
        }

        const gramPrice = prices.dict.get(ASSET_ID.GRAM);
        expect(gramPrice).toBeDefined();
        expect(gramPrice!).toBeGreaterThan(0n); // feed is live -> non-zero
        // sanity: GRAM ~ a couple dollars, not absurd
        expect(Number(gramPrice) / Number(ASSET_PRICE_SCALE)).toBeGreaterThan(0.1);
        expect(Number(gramPrice) / Number(ASSET_PRICE_SCALE)).toBeLessThan(100);
    }, 120000);
});
