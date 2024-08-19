import {createAssetConfig, EVAA_MASTER_MAINNET, EVAA_MASTER_TESTNET} from '../src';
import {beginCell, Dictionary, TonClient} from '@ton/ton';
import dotenv from 'dotenv';

let client: TonClient;


beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
});

test('createAssetConfig test', async () => {
    expect.assertions(2);

    const assetConfigBuilder = createAssetConfig();
    const res = await client.runMethod(EVAA_MASTER_TESTNET, 'getAssetsConfig');
    const cellParsing = res.stack.readCell().beginParse();

    let dictBuilder = beginCell();

    const dict = cellParsing.loadDictDirect(Dictionary.Keys.BigUint(256), createAssetConfig());
    dict.storeDirect(dictBuilder, Dictionary.Keys.BigUint(256), createAssetConfig());
    
    //console.log(dict);
    const dictAgain = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), createAssetConfig(), dictBuilder.asSlice());
    //console.log(dictAgain);

    await expect(cellParsing.remainingBits).toStrictEqual(0);
    await expect(JSON.stringify(dict)).toStrictEqual(JSON.stringify(dictAgain));
});