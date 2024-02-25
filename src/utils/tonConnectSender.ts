import { ITonConnect } from '@tonconnect/sdk';
import { Address, beginCell, Sender, SenderArguments, storeStateInit } from '@ton/core';

export function getTonConnectSender(connector: ITonConnect): Sender {
    return {
        get address(): Address | undefined {
            return connector.account ? Address.parse(connector.account.address) : undefined;
        },

        async send(args: SenderArguments): Promise<void> {
            await connector.sendTransaction({
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