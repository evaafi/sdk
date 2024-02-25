import { beginCell, Cell, Dictionary } from '@ton/core';
import { ethers } from 'ethers';
import sortDeepObjectArrays from 'sort-deep-object-arrays';
import { CoinData } from '../types/Redstone';
import { ASSET_ID } from '../constants';
import { PriceData } from '../types/Common';

type PricePackage = {
    prices: {
        symbol: string;
        value: number;
    }[];
    timestamp: number;
};

type SerializedPricePackage = {
    symbols: string[];
    values: string[];
    timestamp: number;
};

function hexToArrayBuffer(input: any) {
    if (typeof input !== 'string') {
        throw new TypeError('Expected input to be a string');
    }
    if (input.length % 2 !== 0) {
        throw new RangeError('Expected string to be an even number of characters');
    }

    if (input.startsWith('0x')) {
        input = input.slice(2);
    }
    const view = new Uint8Array(input.length / 2);
    for (let i = 0; i < input.length; i += 2) {
        view[i / 2] = parseInt(input.substring(i, i + 2), 16);
    }
    return Buffer.from(view.buffer);
}

function convertStringToBytes32String(str: string) {
    if (str.length > 31) {
        const bytes32StringLength = 32 * 2 + 2; // 32 bytes (each byte uses 2 symbols) + 0x
        if (str.length === bytes32StringLength && str.startsWith('0x')) {
            return str;
        } else {
            return ethers.utils.id(str);
        }
    } else {
        return ethers.utils.formatBytes32String(str);
    }
}

function sortDeepObjects<T>(arr: T[]): T[] {
    return sortDeepObjectArrays(arr);
}

function serializeToMessage(pricePackage: PricePackage): SerializedPricePackage {
    const cleanPricesData = pricePackage.prices.map((p: any) => ({
        symbol: convertStringToBytes32String(p.symbol),
        value: Math.round(p.value * 10 ** 8),
    }));
    const sortedPrices = sortDeepObjects(cleanPricesData);
    const symbols: string[] = [];
    const values: string[] = [];
    sortedPrices.forEach((p: any) => {
        symbols.push(p.symbol);
        values.push(p.value);
    });

    return {
        symbols,
        values,
        timestamp: pricePackage.timestamp,
    };
}
function getLiteDataBytesString(priceData: any): string {
    let data = '';
    for (let i = 0; i < priceData.symbols.length; i++) {
        const symbol = priceData.symbols[i];
        const value = priceData.values[i];
        data += symbol.substr(2) + value.toString(16).padStart(64, '0');
    }
    data += Math.ceil(priceData.timestamp / 1000)
        .toString(16)
        .padStart(64, '0');
    return data;
}

export async function getPrices(): Promise<PriceData | undefined> {
    try {
        const symbols = ['TON', 'USDT', 'USDC']; // , "USDT", "USDC"
        const rawPriceData: { data: Buffer; signature: Buffer }[] = [];
        const priceDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64));
        for (const symbol of symbols) {
            const res = await fetch(`https://api.redstone.finance/prices?symbol=${symbol}&provider=redstone&limit=1`);
            const data = (await res.json()) as CoinData[];
            const price = data[0];
            const serializedPriceData = serializeToMessage({
                prices: [
                    {
                        symbol: price.symbol,
                        value: price.value,
                    },
                ],
                timestamp: price.timestamp,
            });

            switch (serializedPriceData.symbols[0]) {
                case '0x544f4e0000000000000000000000000000000000000000000000000000000000':
                    priceDict.set(ASSET_ID.TON, BigInt(serializedPriceData.values[0]) * 10n);
                    break;
                case '0x5553445400000000000000000000000000000000000000000000000000000000':
                    priceDict.set(ASSET_ID.jUSDT, BigInt(serializedPriceData.values[0]) * 10n);
                    break;
                case '0x5553444300000000000000000000000000000000000000000000000000000000':
                    priceDict.set(ASSET_ID.jUSDC, BigInt(serializedPriceData.values[0]) * 10n);
                    break;
            }

            const signature = hexToArrayBuffer(price.liteEvmSignature);
            rawPriceData.push({
                data: Buffer.from(getLiteDataBytesString(serializedPriceData), 'hex'),
                signature: signature,
            });
        }

        const rawPricesDict = Dictionary.empty<Buffer, Cell>();
        for (const data of rawPriceData) {
            rawPricesDict.set(data.signature, beginCell().storeBuffer(data.data).endCell());
        }

        return {
            dict: priceDict,
            dataCell: beginCell()
                .storeDictDirect(rawPricesDict, Dictionary.Keys.Buffer(65), Dictionary.Values.Cell())
                .endCell(),
        };
    } catch (error) {
        console.error(error);
        return undefined;
    }
}
