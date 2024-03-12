import { ITonConnect, SendTransactionResponse } from '@tonconnect/sdk';
import { Address, beginCell, Sender, SenderArguments, storeStateInit } from '@ton/core';

/*
This is not the best solution to get the BOC of the sent external message, however the Sender
interface does not support returning any value from send(), so at the moment you can get it from
this global variable.
 */
let lastSentBoc: SendTransactionResponse | undefined;

export function getLastSentBoc() {
    return lastSentBoc;
}

export function getTonConnectSender(connector: ITonConnect): Sender {
    return {
        get address(): Address | undefined {
            return connector.account ? Address.parse(connector.account.address) : undefined;
        },

        async send(args: SenderArguments): Promise<void> {
            lastSentBoc = await connector.sendTransaction({
                validUntil: Date.now() + 2 * 60 * 1000, // 1 minutes
                messages: [
                    {
                        address: args.to.toString(),
                        amount: args.value.toString(),
                        payload: args.body?.toBoc().toString('base64'),
                        stateInit: args.init
                            ? beginCell().store(storeStateInit(args.init)).endCell().toBoc().toString('base64')
                            : undefined,
                    },
                ],
            });
        },
    };
}
