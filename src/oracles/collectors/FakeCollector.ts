import { beginCell, Cell, Dictionary } from '@ton/core';
import { ClassicPrices, ClassicPricesMode } from '../prices/ClassicPrices';
import { PoolAssetConfig } from '../../types/Master';
import { FetchConfig } from '../../utils/utils';
import { AbstractCollector } from './AbstractCollector';
import { packAssetsData, packPrices, packOraclesData } from '../utils';
import { keyPairFromSeed, sign } from '@ton/crypto';

function createFakeOracle(id: number, seed: Buffer) {
    const keypair = keyPairFromSeed(seed);
    return {
        id,
        pubkey: keypair.publicKey,
        secret: keypair.secretKey,
    };
}

const fakeOracles = [
    createFakeOracle(0, Buffer.alloc(32, 0)),
    createFakeOracle(1, Buffer.alloc(32, 1)),
    createFakeOracle(2, Buffer.alloc(32, 2)),
    createFakeOracle(3, Buffer.alloc(32, 3)),
];

function packPricesData(timestamp: number, prices: Dictionary<bigint, bigint>): Cell {
    return beginCell()
        .storeUint(timestamp, 32)
        .storeDict(prices, Dictionary.Keys.BigUint(256), Dictionary.Values.BigVarUint(4))
        .endCell();
}

function signPricesData(
    oracle: { secret: Buffer },
    data: { timestamp: number; prices: Dictionary<bigint, bigint> },
): Buffer {
    const packedData = packPricesData(data.timestamp, data.prices);
    return sign(packedData.hash(), oracle.secret);
}

function withSerializers(src: Dictionary<bigint, bigint>): Dictionary<bigint, bigint> {
    const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.BigVarUint(4));
    for (const key of src.keys()) {
        dict.set(key, src.get(key)!);
    }
    return dict;
}

function buildPricesCell(
    pricesDict: Dictionary<bigint, bigint>,
    assetIds: bigint[],
    timestamp: number,
): { dict: Dictionary<bigint, bigint>; dataCell: Cell } {
    const serializedPrices = withSerializers(pricesDict);
    const oraclesData = fakeOracles.map((oracle) => {
        const data = { timestamp, prices: serializedPrices };
        const signature = signPricesData(oracle, data);
        return {
            oracle: { id: oracle.id, pubkey: oracle.pubkey },
            data,
            signature,
        };
    });

    const medianData = assetIds.map((assetId) => ({
        assetId,
        medianPrice: pricesDict.get(assetId)!,
    }));

    const assetsDataCell = packAssetsData(medianData);
    const oraclesDataCell = packOraclesData(oraclesData, assetIds);
    const dataCell = packPrices(assetsDataCell, oraclesDataCell);

    const dict = Dictionary.empty<bigint, bigint>();
    for (const { assetId, medianPrice } of medianData) {
        dict.set(assetId, medianPrice);
    }

    return { dict, dataCell };
}

/**
 * FakeCollector for testing smart contracts.
 *
 * Accepts a Dictionary<bigint, bigint> mapping assetId to price
 * (in ASSET_PRICE_SCALE, i.e. USD price * 1e9) and produces valid
 * ClassicPrices without any network calls.
 *
 * @example
 * ```ts
 * const prices = Dictionary.empty<bigint, bigint>();
 * prices.set(TON_ASSET_ID, 5_000_000_000n);  // $5.00
 * prices.set(USDT_ASSET_ID, 1_000_000_000n); // $1.00
 *
 * const collector = new FakeCollector(prices);
 * const classicPrices = await collector.getPrices();
 * ```
 */
export class FakeCollector extends AbstractCollector {
    readonly #pricesDict: Dictionary<bigint, bigint>;

    constructor(prices: Dictionary<bigint, bigint>) {
        super();
        this.#pricesDict = prices;
    }

    async getPricesForLiquidate(
        _realPrincipals: Dictionary<bigint, bigint>,
        _fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        return this.#buildClassicPrices(ClassicPricesMode.SPOT);
    }

    async getPricesForWithdraw(
        realPrincipals: Dictionary<bigint, bigint>,
        withdrawAsset: PoolAssetConfig,
        collateralToDebt = false,
        fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        return await this.getPrices();
    }

    async getPricesForSupplyWithdraw(
        _realPrincipals: Dictionary<bigint, bigint>,
        _supplyAsset: PoolAssetConfig | undefined,
        _withdrawAsset: PoolAssetConfig | undefined,
        _collateralToDebt: boolean,
        _fetchConfig?: FetchConfig,
    ): Promise<ClassicPrices> {
        return this.#buildClassicPrices(ClassicPricesMode.TWAP);
    }

    async getPrices(_assets?: PoolAssetConfig[], _fetchConfig?: FetchConfig): Promise<ClassicPrices> {
        return this.#buildClassicPrices();
    }

    #buildClassicPrices(mode?: ClassicPricesMode): ClassicPrices {
        const keys = this.#pricesDict.keys();
        if (keys.length === 0) {
            return ClassicPrices.createEmptyPrices();
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const { dict, dataCell } = buildPricesCell(this.#pricesDict, keys, timestamp);

        return new ClassicPrices({
            mode,
            dict,
            dataCell,
            minPublishTime: undefined,
            maxPublishTime: undefined,
        });
    }
}
