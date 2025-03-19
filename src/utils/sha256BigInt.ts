import sha256 from 'crypto-js/sha256';

export function sha256Hash(input: string): bigint {
    const hash = sha256(input);
    const hashHex = hash.toString();
    return BigInt('0x' + hashHex);
}

export function bigIntToBuffer(value: bigint): Buffer {
    let hex = value.toString(16);
    if (hex.length % 2) {
        hex = '0' + hex;
    }
    return Buffer.from(hex, 'hex');
}
