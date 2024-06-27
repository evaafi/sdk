import {createAssetConfig, EVAA_MASTER_MAINNET} from '../src';
import {beginCell, Dictionary, TonClient} from '@ton/ton';
import dotenv from 'dotenv';

let client: TonClient;


beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
});

test('createAssetConfig test', async () => {
    expect.assertions(2);

    const assetConfigBuilder = createAssetConfig();
    const res = await client.runMethod(EVAA_MASTER_MAINNET, 'getAssetsConfig');
    const cellParsing = res.stack.readCell().beginParse();

    let dictBuilder = beginCell();

    const dict = cellParsing.loadDictDirect(Dictionary.Keys.BigUint(256), assetConfigBuilder);
    dict.storeDirect(dictBuilder, Dictionary.Keys.BigUint(256), assetConfigBuilder);
    
    //console.log(dict);
    const dictAgain = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), assetConfigBuilder, dictBuilder.asSlice());
    //console.log(dictAgain);

    await expect(cellParsing.remainingBits).toStrictEqual(0);
    await expect(JSON.stringify(dict)).toStrictEqual(JSON.stringify(dictAgain));
});