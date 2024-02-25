import { Cell, Slice } from '@ton/core';

class MyCell extends Cell {
    toString() {
        return this.hashBigInt().toString();
    }

    hashBigInt() {
        return BigInt('0x' + this.hash().toString('hex'));
    }
}

export function loadMyRef(slice: Slice): MyCell {
    const cell = slice.loadRef();
    return new MyCell({
        exotic: cell.isExotic,
        bits: cell.bits,
        refs: cell.refs,
    });
}

export function loadMaybeMyRef(slice: Slice): Cell | null {
    const cell = slice.loadMaybeRef();
    if (cell === null) {
        return null;
    }
    return new MyCell({
        exotic: cell.isExotic,
        bits: cell.bits,
        refs: cell.refs,
    });
}
