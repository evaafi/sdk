# EVAA SDK Documentation

In this documentation you will find an explanation of how the SDK works and code samples.

## Code Examples

First of all, the environment variables must be set (see .env.example):

- WALLET_MNEMONIC
- RPC_API_KEY

Then you can run the following commands:

- Supply
```shell
npm run supply
```

- Supply - TonConnect
```shell
npm run supply:tonconnect
```

- Withdraw
```shell
npm run withdraw
```

- Liquidation
```shell
npm run liquidation
```


## Getting Started

First of all, you need to get a wrapper class for the Master Contract and open it using TonClient:

```typescript
const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY,
});
const connector = await getConnector();
const evaa = client.open(
    new Evaa({
        testnet: true,
    }),
);
```

Thus, the methods that require ContractProvider as an argument automatically gets it enabling network requests.

Then you need to synchronize the data:

```typescript
await evaa.getSync();
```

At this point, `evaa` has all the necessary information for further work. Mostly we need `AssetsConfig` and `AssetsData`.

## User Contract

With the master contract wrapper, we can get the user contract using two methods:

- getOpenedUserContract: A contract that will be opened by the same client and use the same provider as the master contract.
- openUserContract: Getting a user contract class without opening it, which will allow it to be opened later by another client.

If there is no need for a separate provider, it is recommended to use `getOpenedUserContract` for convenience. After that, we need to [get the current prices](./extended.md#pricedata). There are 2 possible scenarios:


- Very rare case when prices are not available: `getSyncLite` - a method that can get only the token balances on the user contract without calculating other values. This allows you to interact with the contract at a minimum level even if prices are not available.
- Main case: `getSync` - a method that takes **AssetsData**, **AssetsConfig** and **PriceData**. Using these values, it calculates all the necessary limits and useful values for the user.

## Available Operations

MasterContract wrapper provides 3 possible operations: **supply**, **withdraw** and **liquidation**. You can either get ready-to-send messages or send them immediately.

It is possible to use `TonConnect` or available wallet contract wrappers from `@ton/ton` for sending messages. 

Short summary of examples:

- Supply: Manual sending using `@ton/ton` wrapper to calculate external message hash and find transaction later.
- Supply - TonConnect: Sending using TonConnect and getting transaction.
- Withdraw: Simple sending with minimal code.
- Liquidation: Simple sending with minimal code.

### Supply

In the [code](./example/src/supply/index.ts) you can see an example of sending a message to top up the balance using Wallet V4. An important point in this example is that here we get prebuilt message and send it manually:

```typescript
// create signed transfer for out wallet with internal message to EVAA Master Contract
const signedMessage = wallet.createTransfer({
    seqno: await wallet.getSeqno(),
    secretKey: keyPair.secretKey,
    messages: [
        internal({
            to: evaa.address,
            value: toNano(1) + FEES.SUPPLY,
            body: supplyMessage,
        }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    timeout: Math.floor(Date.now() / 1000) + 60,
});
// send this message. send() method creates external and send it, so
// we need to create external message manually for getting its hash
await wallet.send(signedMessage);
```

This was required for getting the external message, using the hash of which, we can easily find our transaction using TonViewer:

```typescript
// create external message manually
const externalMessage = beginCell()
    .store(
        storeMessage(
            external({
                to: wallet.address,
                body: signedMessage,
            }),
        ),
    )
    .endCell();
// get external message hash and link to tonviewer
console.log(`https://testnet.tonviewer.com/transaction/${externalMessage.hash().toString('hex')}`);
```

### Supply - TonConnect

In the [other example](./example/src/tonconnect/index.ts) regarding the same operation, it is shown how you can use TonConnect to send messages. First of all, we need to [get the connector](./example/src/tonconnect/connector.ts):

```typescript
const connector = await getConnector();
```

The next step is to use the `getTonConnectSender` function to get the `Sender` implementation for TonConnect. This allows us to send our messages immediately inside the class method without writing extra code:

```typescript
await evaa.sendSupply(getTonConnectSender(connector), toNano(1) + FEES.SUPPLY, {
    queryID: 0n,
    // we can set always to true, if we don't want to check user code version
    includeUserCode: true,
    amount: toNano(1),
    userAddress: Address.parse(connector.wallet!.account.address),
    assetID: ASSET_ID.TON,
    type: 'ton',
});

const lastSentBoc = getLastSentBoc();
console.log(lastSentBoc);
console.log(
    `https://testnet.tonviewer.com/transaction/${Cell.fromBase64(lastSentBoc!.boc).hash().toString('hex')}`,
);
```

**Important:** To get the external message hash, you want to use the `getLastSentBoc` function. At the moment, this is the only way to get the last sent message. Value of `lastSentBoc` containd only the last sent message.

### Withdraw

For [withdraw operation](./example/src/withdraw/index.ts) we need to get the current prices before sending the message:

```typescript
const priceData = await getPrices();
```

Then, using `dataCell` from `priceData`, we can perform our operation.

### Liquidation

In the [liquidation example](./example/src/liquidation/index.ts) we first need to get the current **AssetsConfig** and **AssetsData**, and then the current prices:

```typescript
await evaa.getSync();
const priceData = await getPrices();
```

Then we need to get the user contract instance that we want to check for liquidation:

```typescript
// get user contract that already opened by same client
// alternative: openUserContract method, which return only instance of user contract without opening
const user = evaa.getOpenedUserContract(wallet.address);
await user.getSync(evaa.data!.assetsData, evaa.data!.assetsConfig, priceData!.dict);
```

Now we can calculate all the necessary data and check if the user is liquidable using the `isLiqidable` field. If yes, we can get the necessary information (`liquidationBaseData`). Using these values, we can liquidate the user:

```typescript
if (user.isLiquidable) {
    const liquidationData = user.liquidationParameters!;
    // if user code version is outdated, includeUserCode should be true for upgrade this contract
    const includeUserCode = evaa.data!.upgradeConfig.userCodeVersion !== user.liteData!.codeVersion;
    if (liquidationData.tonLiquidation) {
        await evaa.sendLiquidation(wallet.sender(keyPair.secretKey), FEES.LIQUIDATION, {
            queryID: 0n,
            liquidatorAddress: wallet.address,
            includeUserCode: includeUserCode,
            priceData: priceData!.dataCell,
            ...liquidationData,
            type: 'ton',
        });
    } else {
        const sender: Sender = {
             address: wallet.address,
             send: wallet.sender(keyPair.secretKey).send
        };
        await evaa.sendLiquidation(sender, FEES.LIQUIDATION_JETTON, {
            queryID: 0n,
            liquidatorAddress: wallet.address,
            includeUserCode: includeUserCode,
            priceData: priceData!.dataCell,
            ...liquidationData,
            responseAddress: wallet.address,
            forwardAmount: FEES.LIQUIDATION_JETTON_FWD,
            type: 'jetton',
        });
    }
}
```

## Additional

In the `supply` and `liquidation` operations may involve jettons, which means that the first message must be sent to the jetton's wallet rather than to the master contract.

In this case, the SDK will calculate the jetton wallet address and send the message to it, so no additional actions are required. The only change is to add optional fields `responseDestination` and `forwardAmount`.

## Extended Documentation

For more detailed information, you can check the [extended documentation](./extended.md).
