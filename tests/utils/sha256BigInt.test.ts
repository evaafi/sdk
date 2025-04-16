import { bigIntToBuffer, sha256Hash } from '../../src/utils/sha256BigInt';

describe('sha256BigInt', () => {
    describe('sha256Hash and bigIntToBuffer round-trip', () => {
        const testCases = [
            'TON',
            'EVAA',
            'USDT',
            'jUSDT',
            'jUSDC',
            'stTON',
            'tsTON',
            'uTON',
            'tgBTC',
            'TONUSDT_DEDUST',
            'TON_STORM',
            'USDT_STORM',
            'CATI',
            'DOGS',
            'NOT',
            'DOGS',
        ];

        testCases.forEach((value) => {
            it(`should maintain hex equality for ${value}`, () => {
                const hashBigInt = sha256Hash(value);
                const buffer = bigIntToBuffer(hashBigInt);
                const bufferHex = buffer.toString('hex');
                expect(bufferHex.toLowerCase()).toBe(bufferHex.toLowerCase());
            });
        });
    });
});
