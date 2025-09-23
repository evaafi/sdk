import 'dotenv/config';

import { KeyPair, mnemonicToWalletKey } from '@ton/crypto';
import { Cell, OpenedContract, TonClient, WalletContractV4 } from '@ton/ton';
import { Evaa, TESTNET_PYTH_POOL_CONFIG_TOB_AUDITED, TON_TESTNET } from '../../src';

describe('SW - Separated supply on testnet', () => {
    let TON_CLIENT: TonClient;
    let WALLET_KEY_PAIR: KeyPair;
    let WALLET_CONTRACT: OpenedContract<WalletContractV4>;
    let EVAA_TESTNET: OpenedContract<Evaa>;
    beforeAll(async () => {
        TON_CLIENT = new TonClient({
            endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
            apiKey: process.env.RPC_API_KEY_TESTNET,
        });
        WALLET_KEY_PAIR = await mnemonicToWalletKey(process.env.TESTNET_WALLET_MNEMONIC!.split(' '));

        WALLET_CONTRACT = TON_CLIENT.open(
            WalletContractV4.create({
                workchain: 0,
                publicKey: WALLET_KEY_PAIR.publicKey,
            }),
        );

        EVAA_TESTNET = TON_CLIENT.open(new Evaa({ poolConfig: TESTNET_PYTH_POOL_CONFIG_TOB_AUDITED, debug: true }));
    });

    test('sendSupply executes without throwing', async () => {
        console.log(WALLET_CONTRACT.address.toString());
        const balance = await WALLET_CONTRACT.getBalance();
        console.log('wallet balance', balance.toString());
        if (balance === 0n) {
            console.log(`Wallet ${WALLET_CONTRACT.address} balance is 0, skipping supply`);
            return;
        }
        const WALLET_SENDER = {
            address: WALLET_CONTRACT.address,
            send: WALLET_CONTRACT.sender(WALLET_KEY_PAIR.secretKey).send,
        };

        // Value attached to the message (in nanotons)
        const value = 2_000_000_000n;

        await EVAA_TESTNET.sendSupply(WALLET_SENDER, value, {
            queryID: 0n,
            includeUserCode: true,
            amount: 500_000_000n,
            userAddress: WALLET_CONTRACT.address,
            asset: TON_TESTNET,
            payload: Cell.EMPTY,
            customPayloadRecipient: WALLET_CONTRACT.address,
            subaccountId: 0,
            customPayloadSaturationFlag: false,
            returnRepayRemainingsFlag: false,
        });

        console.log('Supply sent');
    });
});
