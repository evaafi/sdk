import { Builder, Cell, Dictionary, DictionaryKey, DictionaryKeyTypes, Slice, beginCell } from "@ton/core";

function readUnaryLength(slice: Slice) {
    let res = 0;
    while (slice.loadBit()) {
        res++;
    }
    return res;
}

function endExoticCell(b: Builder): Cell {
    let c = b.endCell();
    return new Cell({exotic: true, bits: c.bits, refs: c.refs});
}

export function convertToMerkleProof(c: Cell): Cell {
    return endExoticCell(beginCell()
        .storeUint(3, 8)
        .storeBuffer(c.hash(0))
        .storeUint(c.depth(0), 16)
        .storeRef(c));
}

function convertToPrunedBranch(c: Cell): Cell {
    return endExoticCell(beginCell()
        .storeUint(1, 8)
        .storeUint(1, 8)
        .storeBuffer(c.hash(0))
        .storeUint(c.depth(0), 16));
}

function doGenerateMerkleProof(
    prefix: string,
    slice: Slice,
    n: number,
    keys: string[]
): Cell {
    // Reading label
    const originalCell = slice.asCell();

    if (keys.length == 0) {
        // no keys to prove, prune the whole subdict
        return convertToPrunedBranch(originalCell);
    }

    let lb0 = slice.loadBit() ? 1 : 0;
    let prefixLength = 0;
    let pp = prefix;

    if (lb0 === 0) {
        // Short label detected

        // Read
        prefixLength = readUnaryLength(slice);

        // Read prefix
        for (let i = 0; i < prefixLength; i++) {
            pp += slice.loadBit() ? '1' : '0';
        }
    } else {
        let lb1 = slice.loadBit() ? 1 : 0;
        if (lb1 === 0) {
            // Long label detected
            prefixLength = slice.loadUint(Math.ceil(Math.log2(n + 1)));
            for (let i = 0; i < prefixLength; i++) {
                pp += slice.loadBit() ? '1' : '0';
            }
        } else {
            // Same label detected
            let bit = slice.loadBit() ? '1' : '0';
            prefixLength = slice.loadUint(Math.ceil(Math.log2(n + 1)));
            for (let i = 0; i < prefixLength; i++) {
                pp += bit;
            }
        }
    }

    if (n - prefixLength === 0) {
        return originalCell;
    } else {
        let sl = originalCell.beginParse();
        let left = sl.loadRef();
        let right = sl.loadRef();
        // NOTE: Left and right branches are implicitly contain prefixes '0' and '1'
        if (!left.isExotic) {
            const leftKeys = keys.filter((key) => {
                return pp + '0' === key.slice(0, pp.length + 1);
            });
            left = doGenerateMerkleProof(
                pp + '0',
                left.beginParse(),
                n - prefixLength - 1,
                leftKeys
            );
        }
        if (!right.isExotic) {
            const rightKeys = keys.filter((key) => {
                return pp + '1' === key.slice(0, pp.length + 1);
            });
            right = doGenerateMerkleProof(
                pp + '1',
                right.beginParse(),
                n - prefixLength - 1,
                rightKeys
            );
        }

        return beginCell()
            .storeSlice(sl)
            .storeRef(left)
            .storeRef(right)
            .endCell();
    }
}

export function generateMerkleProofDirect<K extends DictionaryKeyTypes, V>(
    dict: Dictionary<K, V>,
    keys: K[],
    keyObject: DictionaryKey<K>
): Cell {
    keys.forEach((key) => {
        if (!dict.has(key)) {
            throw new Error(`Trying to generate merkle proof for a missing key "${key}"`)
        }
    })
    const s = beginCell().storeDictDirect(dict).asSlice();
    return doGenerateMerkleProof(
            '',
            s,
            keyObject.bits,
            keys.map((key) => keyObject.serialize(key).toString(2).padStart(keyObject.bits, '0'))
    );
}

export function generateMerkleProof<K extends DictionaryKeyTypes, V>(
    dict: Dictionary<K, V>,
    keys: K[],
    keyObject: DictionaryKey<K>
): Cell {
    return convertToMerkleProof(generateMerkleProofDirect(dict, keys, keyObject));
}