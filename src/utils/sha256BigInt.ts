import sha256 from 'crypto-js/sha256';

export function sha256Hash(input: string): bigint {
    const hash = sha256(input);
    const hashHex = hash.toString();
    return BigInt('0x' + hashHex);
}
