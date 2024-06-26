import {createAssetConfig, EVAA_MASTER_MAINNET} from '../src';
import {Builder, Dictionary, TonClient} from '@ton/ton';
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
    expect.assertions(1);

    const assetConfig = createAssetConfig();
    const res = await client.runMethod(EVAA_MASTER_MAINNET, 'getAssetsConfig');
    const cell = res.stack.readCell();

    const slice = cell.asSlice()
    const dict = slice.loadDictDirect(Dictionary.Keys.BigUint(256), assetConfig);
    let builder = new Builder();
    dict.storeDirect(builder, Dictionary.Keys.BigUint(256), assetConfig);
    
    const endCell = builder;
    //console.log(dict);
    const dictAgain = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), assetConfig, endCell.asSlice());
    //console.log(dictAgain);

    await expect(JSON.stringify(dict)).toStrictEqual(JSON.stringify(dictAgain));
});