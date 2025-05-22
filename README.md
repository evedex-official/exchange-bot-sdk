
# Node.js & JavaScript SDK for Evedex REST APIs & WebSockets

[TOC]

This SDK enables programmatic access to [Evedex exchange](https://demo-exchange.evedex.com/en-US/) services, including market data streaming, account metrics, and order management.

- Integration sdk with Evedex REST APIs and WebSockets.
- TypeScript support (with type declarations for most API requests & responses).
- Auth with wallet private keys or with API keys
- Realtime balances, positions, orderbook, and order state updates with cache management.
- Methods for working with orders by wallet account: create replace cancel orders.
- Includes internally sign request payloads for orders, positions and withdraw methods

## Installation

1. Init npm project

2. Install exchange-bot-sdk dependency

```
npm i @evedex/exchange-bot-sdk --save
```

## Usage

### Initialize container

You can use demo (for testing purposes) or production environments. For initializing container you need to pass websocket instance.


If you are using Node environment you need to install `ws` additionally:

```
npm i ws --save
```

And use it during initialize container method

```ts
import { WebSocket } from 'ws';
```

#### DEMO TRADING ENVIRONMENT

```ts
const container = new evedexSdk.DemoContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {
    baseAccount: {
      privateKey: "0x...",
    },
  },
  apiKeys: {},
});
```

#### PRODUCTION ENVIRONMENT

```ts
const container = new evedexSdk.ProdContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {
    baseAccount: {
      privateKey: "0x...",
    },
  },
  apiKeys: {},
});
```


### Initialize account

#### Api key account

ApiKeyAccount is designed to read user account state, including: balances, positions, orders.

You can create api key if you already logged in to evedex exchange.

Go to profile menu by clicking on avatar at the upper right corner => go to settings => API => create API key

Init example:

```ts
import * as evedexSdk from "@evedex/exchange-bot-sdk";

const container = evedexSdk.initContainer(evedexSdk.Environment.DEMO, {
  centrifugeWebSocket: WebSocket,
  wallets: {},
  apiKeys: {
    mainApiKey: {
      apiKey: "cUxD***uOUQ=",
    },
  },
})

// or
const demoContainer = new evedexSdk.DemoContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {},
  apiKeys: {
    mainApiKey: {
      apiKey: "cUxD***uOUQ=",
    },
  },
});
```

#### Wallet account

WalletAccout has all posibilities to read user account state and also includes:

- Methods to work with orders (create, replace, cancel, mass cancel) with signing them internally

- Methods to work with positions

- Methods to work with balances

Init example:

```ts
import * as evedexSdk from "@evedex/exchange-bot-sdk";

const container = new evedexSdk.DemoContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {
    baseAccount: {
      privateKey: "0x...",
    },
  },
});
```

#### Balance

Balance instance is designed for calculate available user balance and handle exchange events.

Methods with get prefix returns cached state, here is list of this methods:
 - getFundingQuantity(currency)
 - getPositionList()
 - getPosition(instrument)
 - getOrderList()
 - getTpSlList()
 - getAvailableBalance()
 - getPower(instrument)

Methods with fetch prefix are used for retrieving data from REST API:
 - fetchTpSlList(query) - Fetches TP/SL list
 - fetchMe() - Fetches user info
 - fetchPositions() - Fetches positions
 - fetchOrders(orderListQuery) - Fetches orders
 - fetchAvailableBalance() - Fetches available balance
 - fetchOpenOrders() - Fetches open orders

Balance `listen` method subscribes for exchange events: updates positions, orders, funding, tpsl.

Signals are disgned for handling events:
 - onAccountUpdate
 - onFundingUpdate
 - onPositionUpdate
 - onOrderUpdate
 - onTpSlUpdate


```ts
import * as evedexSdk from "@evedex/exchange-bot-sdk";

const container = new evedexSdk.DemoContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {
    baseAccount: {
      privateKey: "0x...",
    },
  },
});

const account = await container.account("baseAccount");

const balance = account.getBalance();

balance.listen();

console.log(balance.getPower("BTCUSDT:DEMO"));

console.log(await balance.fetchOrders({ instrument: "BTCUSDT:DEMO" }));

balance.onAccountUpdate(a => console.info(a));
```

### Examples

Here is full example of sdk usage:

```ts

import * as evedexSdk from "@evedex/exchange-bot-sdk";
import { AxiosError } from "axios";
import WebSocket from 'ws';

const cfg = {
  centrifugeWebSocket: WebSocket,
	// your wallet private key
  wallets: { myWallet: { privateKey: "5b7..." } },
	// your api key
  apiKeys: { myApiKey: { apiKey: "GNL+Y/VgRj..." } }
}

const container = new evedexSdk.DemoContainer(cfg);  // or ProdContainer
const gateway = container.gateway();                 // for public api methods

const sampleMarketData = async () => {
  //let's subscribe to the order book update and print 1st value
  console.log("Subscribing to order book update");
  gateway.onOrderBookUpdate(o => { console.log(o); gateway.unListenOrderBook("BTCUSDT:DEMO"); });
  gateway.listenOrderBook("BTCUSDT:DEMO");

  //let's subscribe to the order book best update and print 1st value
  console.log("Subscribing to order book best update");
  gateway.onOrderBookBestUpdate(o => { console.log(o); gateway.unListenOrderBookBest("BTCUSDT:DEMO"); });
  gateway.listenOrderBookBest("BTCUSDT:DEMO");

  //let's fetch orderbook directly
  console.log(await gateway.fetchMarketDepth({ instrument: "BTCUSDT:DEMO", maxLevel: 10}));

  //let's fetch instruments
  console.log((await container.gateway().fetchInstrumentsWithMetrics()).find(i => i.name === "BTCUSDT:DEMO"));
  console.log((await container.gateway().fetchInstruments()).find(i => i.name === "BTCUSDT:DEMO"));

  //lets fetch coins
  console.log((await gateway.fetchCoins()).find((c: any) => c.name === "BTC"));
  console.log(await gateway.fetchTrades({ instrument: "BTCUSDT:DEMO" }));
}

const sampleAccountData = async (account: evedexSdk.WalletAccount | evedexSdk.ApiKeyAccount) => {
  //show account info
  console.log(await account.fetchMe());
  const accountState = account.getBalance();  // for account ws callbacks and state
  // let's subscribe to account state metrics
  await accountState.listen(); //await is important here as it will wait till cache is populated
  console.log("Account metrics subscription done, getting state now:");

  // log current state from cache
  console.log(accountState.getOrderList().filter(o => o.status === evedexSdk.OrderStatus.New));
  console.log(accountState.getFundingQuantity(evedexSdk.CollateralCurrency.USDT));
  console.log(accountState.getAvailableBalance());
  console.log(accountState.getPositionList());
  console.log(accountState.getTpSlList());
  console.log(accountState.getPower("BTCUSDT:DEMO"));

  //also we can fetch the same data from gateway directly
  console.log(await account.fetchOrders({ instrument: "BTCUSDT:DEMO" }));
  console.log(await account.fetchPositions());
  console.log(await account.fetchAvailableBalance());
  console.log(await account.fetchTpSlList({ instrument: "BTCUSDT:DEMO" }));

  //now let's attach callbacks to account updates to print new values
  console.log("Subscribing to account updates");
  accountState.onAccountUpdate(a => console.info(a));
  accountState.onFundingUpdate(f => console.info(f));
  accountState.onPositionUpdate(p => console.info(p));
  accountState.onOrderUpdate(o => console.info(o));
  accountState.onTpSlUpdate(t => console.info(t));
}

const sampleOrders = async (account: evedexSdk.WalletAccount) => {
  // //this is how leverage is managed
  await account.updatePosition({instrument: "BTCUSDT:DEMO", leverage: 20});

  console.log("Placing limit order");
  const md = await gateway.fetchMarketDepth({ instrument: "BTCUSDT:DEMO", maxLevel: 1});

  const limitOrder = {
    instrument: "BTCUSDT:DEMO",
    side: evedexSdk.Side.Buy,
    quantity: 0.001,
    limitPrice: md.bids[0].price - 500,
    leverage: 20
  }
  const order = await account.createLimitOrder(limitOrder);
  console.info(`Order created: ${order.id}`);
  console.log("Cancelling limit order...");

  await account.cancelOrder({ orderId: order.id });
  try {
    //both queries will fail with 400 as order is already cancelled
    await account.massCancelUserOrders({ instrument: "BTCUSDT:DEMO" });
    await account.massCancelUserOrdersById({ orderIds: [order.id] });
  }
  catch (e: any) { if (e instanceof AxiosError) console.log(e.response?.data.error)}
}

const main = async () => {
  const account = await container.account("myWallet");           // for account methods
  const apiKeyAccount = await container.apiKeyAccount("myApiKey"); // for readonly account methods via api key
  console.log("Init done");

 await sampleMarketData();
 await sampleAccountData(apiKeyAccount); // or apiKeyAccount
 await sampleOrders(account); //order placements only for wallet account

  console.log("Done");
}

main().catch(e => console.error(e));
```

### How to get test USDT in Development environment
For your convenience there's a test faucet that immediately deposits 1000 USDT to your smart-account in Development environment.

1. The first run happens automatically when you register on https://demo-exchange.evedex.com
1. After that you can once in a while request test funds using the button "Request Demo Funds" in the bottom-right of the Exchange screen.

## Methods tree

### Container
 - constructor(config: ContainerConfig)
 - wallet(walletName: string) - Returns Wallet instance
 - [account(walletName: string) - Returns WalletAccount](#wallet-account)
 - apiKey(apiKeyName: string) - Returns ApiKey
 - [apiKeyAccount(apiKeyName: string) - Returns ApiKeyAccount](#api-key-account)
 - gateway() - Returns Gateway instance (deprecated not recommended to use)
 - closeWsConnection() - Close centrifuge websocket connection

### ApiKeyAccount
 - constructor(options: ApiKeyAccountOptions)
 - gateway() - Returns parent gateway (deprecated not recommended to use)
 - authGateway() - Returns auth gateway (deprecated not recommended to use)
 - exchangeGateway() - Returns exchange gateway (deprecated not recommended to use)
 - wsGateway() - Returns websocket gateway (deprecated not recommended to use)
 - exchangeAccount() - Returns exchange account
 - session() - Returns current session
 - [getBalance() - Returns balance](#balance)
 - fetchTpSlList(query) - Fetches TP/SL list
 - fetchMe() - Fetches user info
 - fetchPositions() - Fetches positions
 - fetchOrders(orderListQuery) - Fetches orders
 - fetchAvailableBalance() - Fetches available balance
 - fetchOpenOrders() - Fetches open orders

### WalletAccount (extends SessionAccount)

 - constructor(options: WalletAccountOptions)
 - Has all ApiKeyAccount methods
Order management:
 - createWithdraw(withdraw)
 - createClosePositionOrder(order)
 - updatePosition(query)
 - createLimitOrder(order)
 - replaceLimitOrder(order)
 - batchReplaceLimitOrder(orderList)
 - createMarketOrder(order)
 - createStopLimitOrder(order)
 - replaceStopLimitOrder(order)
 - cancelOrder(query)
 - massCancelUserOrders(query)
 - massCancelUserOrdersById(query)
 - createTpSl(tpsl)
 - updateTpSl(query)
 - cancelTpSl(query)

### Balance
 - constructor(options: BalanceOptions)
 - getFundingQuantity(currency)
 - getPositionList()
 - getPosition(instrument)
 - getOrderList()
 - getTpSlList()
 - getAvailableBalance()
 - getPower(instrument)
Event handlers:
 - onAccountUpdate
 - onFundingUpdate
 - onPositionUpdate
 - onOrderUpdate
 - onTpSlUpdate
Subscription management:
 - listen()
 - unListen()
