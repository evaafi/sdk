import { beginCell, Cell, Dictionary } from '@ton/core';
import { ethers } from 'ethers';
import { CoinData } from '../types/Redstone';
import { ASSET_ID } from '../constants';
import { PriceData } from '../types/Common';

type SerializedPrice = {
    symbol: string;
    value: number;
    timestamp: number;
};

type PriceRawData = {
    data: Buffer;
    signature: Buffer;
    dictKey: bigint;
    dictValue: bigint;
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

export function getLiteDataBytesString(priceData: SerializedPrice): string {
    let data = priceData.symbol.substr(2) + priceData.value.toString(16).padStart(64, '0');

    data += Math.ceil(priceData.timestamp / 1000)
        .toString(16)
        .padStart(64, '0');
    return data;
}

async function getPrice(symbol: string): Promise<PriceRawData> {
    const res = await fetch(`https://api.redstone.finance/prices?symbol=${symbol}&provider=redstone&limit=1`);
    const data = (await res.json()) as CoinData[];
    const price = data[0];

    const message = {
        symbol: convertStringToBytes32String(price.symbol),
        value: Math.round(price.value * 10 ** 8),
        timestamp: price.timestamp,
    };

    let dictKey: bigint;
    const dictValue = BigInt(message.value) * 10n;
    switch (message.symbol) {
        case '0x544f4e0000000000000000000000000000000000000000000000000000000000':
            dictKey = ASSET_ID.TON;
            break;
        case '0x5553445400000000000000000000000000000000000000000000000000000000':
            dictKey = ASSET_ID.jUSDT;
            break;
        case '0x5553444300000000000000000000000000000000000000000000000000000000':
            dictKey = ASSET_ID.jUSDC;
            break;
        default:
            throw new Error('Unknown symbol');
    }

    const signature = hexToArrayBuffer(price.liteEvmSignature);

    return {
        data: Buffer.from(getLiteDataBytesString(message), 'hex'),
        signature: signature,
        dictKey: dictKey,
        dictValue: dictValue,
    };
}

export async function getPrices(): Promise<PriceData | undefined> {
    try {
        const symbols = ['TON', 'USDT', 'USDC'];
        const rawPriceData: {
            data: Buffer;
            signature: Buffer;
        }[] = [];
        const priceDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64));
        const pricePromises = symbols.map(async (symbol) => {
            const price = await getPrice(symbol);
            priceDict.set(price.dictKey, price.dictValue);
            rawPriceData.push(price);
        });
        await Promise.all(pricePromises);

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
