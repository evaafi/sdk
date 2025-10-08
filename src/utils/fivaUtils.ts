import { Address } from "@ton/core";

export function calculateCloseAddress(address: Address, closeToAddress: Address): Address {
  const curHashpart = BigInt('0x' + address.hash.toString('hex'));
  const desiredHashpart = BigInt('0x' + closeToAddress.hash.toString('hex'));

  const rewriteBits = 8;
  const mask = (1n << BigInt(256 - rewriteBits)) - 1n;
  const antimask = invertBigInt(mask, 256);

  const newHashpart = (curHashpart & mask) | (desiredHashpart & antimask);
  return new Address(0, bigIntToBuffer(newHashpart, 256));
}

function invertBigInt(value: bigint, bits: number): bigint {
  const maxValue = (1n << BigInt(bits)) - 1n;
  return value ^ maxValue;
}

function bigIntToBuffer(value: bigint, bits: number): Buffer {
  const hex = value.toString(16).padStart(bits / 4, '0');
  return Buffer.from(hex, 'hex');
}
