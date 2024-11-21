import { beginCell, Cell, Dictionary } from "@ton/core";
import { RawPriceData, verifyPricesSign, verifyRawPriceDataSign } from "../../src";

describe('Utils tests', () => {
    const packedPrices = 'b5ee9c7241020c0100011400010966b21236c001020120020702012003060201200405004dbf748433fcbcc1ac75e54798fb9cdfd8d368b8d6ae3092f4c291cf8465590f7b14a028b5169450004dbf6627c5eaf750e15e689006a18f136130fa2b6874a62e57f9c529bc43cfae49cea02a23141af0004dbf895668e908644f30322b997de8faaafc21f05aa52f8982f042dac1fe0b4d09d05015345cb0e8020120080b020120090a004bbf47b22d8d0a21004209a3eeb54d9c61d63c8ef5dbc1a701ddc4311c1cacb03f8c877345b810004bbf670f2d046c32f2b194958abd36b7c71cd118ec635f0990ceac863e9350f1de668774113350004bbf8a9006bd3fb03d355daeeff93b24be90afaa6e3ca0073ff5720f8a852c93327843ba0899a86a405464';

    test('verifySign', async () => {
        const priceData: RawPriceData = {
            oracleId: 0,
            dataCell: beginCell().storeRef(Cell.fromBoc(Buffer.from(packedPrices, 'hex'))[0]).endCell(),
            dict: Dictionary.empty(),
            pubkey: Buffer.from('473a72ac2bbfc14da3a77314c2cb73e755b88e7d1d6eae05ea88b4ce176a46c9', 'hex'),
            signature: Buffer.from('cb79689019b8968bd7cea4855bc7f9f9ea06674a3ced955c16878addb7dd49985760908734c2b6119df48d034a0276b4b5affa50cb2a88d6173a7716e6ba8e0b', 'hex'),
            timestamp: 0
        };

        const res = verifyRawPriceDataSign(priceData);

        expect(res).toEqual(true);
    });

    test('verifySign', async () => {
        const priceData: RawPriceData = {
            oracleId: 0,
            dataCell: beginCell().storeRef(Cell.fromBoc(Buffer.from(packedPrices, 'hex'))[0]).endCell(),
            dict: Dictionary.empty(),
            pubkey: Buffer.from('473a72ac2bbfc14da3a77314c2cb73e755b88e7d1d6eae05ea88b4ce176a46c9', 'hex'),
            signature: Buffer.from('cb89689019b8968bd7cea4855bc7f9f9ea06674a3ced955c16878addb7dd49985760908734c2b6119df48d034a0276b4b5affa50cb2a88d6173a7716e6ba8e0b', 'hex'),
            timestamp: 0
        };

        const res = verifyRawPriceDataSign(priceData);

        expect(res).toEqual(false);
    });
});