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
import { WebSocket } from "ws";
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

<details>
<summary>Init example</summary>

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
});

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

</details>

#### Wallet account

WalletAccout has all posibilities to read user account state and also includes:

- Methods to work with orders (create, replace, cancel, mass cancel) with signing them internally

- Methods to work with positions

- Methods to work with balances

<details>
<summary>Init example</summary>

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

</details>

#### Balance

Balance instance is designed for calculate available user balance and handle exchange events.

Methods with get prefix returns cached state, here is list of this methods:

- getFundingQuantity(currency) —
- getPositionList() —
- getPosition(instrument) —
- getOrderList() —
- getTpSlList() —
- getAvailableBalance() —
- getPower(instrument) —

Methods with fetch prefix are used for retrieving data from REST API:

- fetchTpSlList(query) — Fetches TP/SL list
- fetchMe() — Fetches user info
- fetchPositions() — Fetches positions
- fetchOrders(orderListQuery) — Fetches orders
- fetchAvailableBalance() — Fetches available balance
- fetchOpenOrders() — Fetches open orders

Balance `listen` method subscribes for exchange events: updates positions, orders, funding, tpsl.

Signals are disgned for handling events:

- onAccountUpdate
- onFundingUpdate
- onPositionUpdate
- onOrderUpdate
- onTpSlUpdate

<details>
<summary>Sample</summary>

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

balance.onAccountUpdate((a) => console.info(a));
```

</details>

### Examples

<details>
<summary>Full example of sdk usage:</summary>

```ts
import * as evedexSdk from "@evedex/exchange-bot-sdk";
import { AxiosError } from "axios";
import WebSocket from "ws";

const cfg = {
  centrifugeWebSocket: WebSocket,
  // your wallet private key
  wallets: { myWallet: { privateKey: "5b7..." } },
  // your api key
  apiKeys: { myApiKey: { apiKey: "GNL+Y/VgRj..." } },
};

const container = new evedexSdk.DemoContainer(cfg); // or ProdContainer
const gateway = container.gateway(); // for public api methods

const sampleMarketData = async () => {
  //let's subscribe to the order book update and print 1st value
  console.log("Subscribing to order book update");
  gateway.onOrderBookUpdate((o) => {
    console.log(o);
    gateway.unListenOrderBook("BTCUSDT:DEMO");
  });
  gateway.listenOrderBook("BTCUSDT:DEMO");

  //let's subscribe to the order book best update and print 1st value
  console.log("Subscribing to order book best update");
  gateway.onOrderBookBestUpdate((o) => {
    console.log(o);
    gateway.unListenOrderBookBest("BTCUSDT:DEMO");
  });
  gateway.listenOrderBookBest("BTCUSDT:DEMO");

  //let's fetch orderbook directly
  console.log(await gateway.fetchMarketDepth({ instrument: "BTCUSDT:DEMO", maxLevel: 10 }));

  //let's fetch instruments
  console.log(
    (await container.gateway().fetchInstrumentsWithMetrics()).find(
      (i) => i.name === "BTCUSDT:DEMO",
    ),
  );
  console.log(
    (await container.gateway().fetchInstruments()).find((i) => i.name === "BTCUSDT:DEMO"),
  );

  //lets fetch coins
  console.log((await gateway.fetchCoins()).find((c: any) => c.name === "BTC"));
  console.log(await gateway.fetchTrades({ instrument: "BTCUSDT:DEMO" }));
};

const sampleAccountData = async (account: evedexSdk.WalletAccount | evedexSdk.ApiKeyAccount) => {
  //show account info
  console.log(await account.fetchMe());
  const accountState = account.getBalance(); // for account ws callbacks and state
  // let's subscribe to account state metrics
  await accountState.listen(); //await is important here as it will wait till cache is populated
  console.log("Account metrics subscription done, getting state now:");

  // log current state from cache
  console.log(accountState.getOrderList().filter((o) => o.status === evedexSdk.OrderStatus.New));
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
  accountState.onAccountUpdate((a) => console.info(a));
  accountState.onFundingUpdate((f) => console.info(f));
  accountState.onPositionUpdate((p) => console.info(p));
  accountState.onOrderUpdate((o) => console.info(o));
  accountState.onTpSlUpdate((t) => console.info(t));
};

const sampleOrders = async (account: evedexSdk.WalletAccount) => {
  // //this is how leverage is managed
  await account.updatePosition({ instrument: "BTCUSDT:DEMO", leverage: 20 });

  console.log("Placing limit order");
  const md = await gateway.fetchMarketDepth({ instrument: "BTCUSDT:DEMO", maxLevel: 1 });

  const limitOrder = {
    instrument: "BTCUSDT:DEMO",
    side: evedexSdk.Side.Buy,
    quantity: 0.001,
    limitPrice: md.bids[0].price - 500,
    leverage: 20,
  };
  const order = await account.createLimitOrder(limitOrder);
  console.info(`Order created: ${order.id}`);
  console.log("Cancelling limit order...");

  await account.cancelOrder({ orderId: order.id });
  try {
    //both queries will fail with 400 as order is already cancelled
    await account.massCancelUserOrders({ instrument: "BTCUSDT:DEMO" });
    await account.massCancelUserOrdersById({ orderIds: [order.id] });
  } catch (e: any) {
    if (e instanceof AxiosError) console.log(e.response?.data.error);
  }
};

const main = async () => {
  const account = await container.account("myWallet"); // for account methods
  const apiKeyAccount = await container.apiKeyAccount("myApiKey"); // for readonly account methods via api key
  console.log("Init done");

  await sampleMarketData();
  await sampleAccountData(apiKeyAccount); // or apiKeyAccount
  await sampleOrders(account); //order placements only for wallet account

  console.log("Done");
};

main().catch((e) => console.error(e));
```

</details>

### How to get test USDT in Development environment

For your convenience there's a test faucet that immediately deposits 1000 USDT to your smart-account in Development environment.

1. The first run happens automatically when you register on https://demo-exchange.evedex.com
1. After that you can once in a while request test funds using the button "Request Demo Funds" in the bottom-right of the Exchange screen.

## Methods tree

### Container

- `constructor(config: ContainerConfig)` — Initialize container instance.

<details>
<summary>Init container usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
```

</details>

- `wallet(walletName: string)` — Returns Wallet class instance.

<details>
<summary>Wallet method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const wallet = devContainer.wallet("myWallet");
```

The Wallet class provides methods for interacting with an Ethereum wallet using the ethers library.

Method Explanations:

- `getChainId()`: Returns the chain ID of the Ethereum network, either from the provided options.chain string or by querying the signer's provider.
- `getAddress()`: Returns the Ethereum address associated with the wallet.
- `solidityPackedKeccak256(types, values)`: Computes the Solidity-packed Keccak-256 hash of the provided types and values.
- `getBytes(value)`: Returns the bytes representation of the provided value string.
- `serializeSignature(signature)`: Serializes the provided signature string into a format suitable for transmission.
- `signMessage(message)`: Signs the provided message string or Uint8Array using the wallet's private key.
- `signTypedData(domain, types, value)`: Signs the provided domain, types, and value using the wallet's private key, according to the EIP-712 typed data specification.

</details>

- account(walletName: string) — Returns [WalletAccount instance](#wallet-account).

 <details>
<summary>Account method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
```

</details>

- apiKey(apiKeyName: string) — Returns user api key by config name.

<details>
<summary>apiKey method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const userApiKey = devContainer.apiKey("mainApiKey"); // returns 'your-api-key'
```

</details>
 
 - apiKeyAccount(apiKeyName: string) — Returns [ApiKeyAccount instance](#api-key-account). 
 
 <details>
<summary>apiKeyAccount method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
```

 </details>
 
 - gateway() — Returns Gateway instance (deprecated, not recommended to use). Returns a `Gateway` class instance.
 - closeWsConnection() — Close centrifuge websocket connection.

### ApiKeyAccount

The ApiKeyAccount class represents an API key account, which provides methods for interacting with an exchange gateway.

To initialize `ApiKeyAccount` you need to pass your API key to container config.

Class Methods

Getters:

- `gateway`: Returns the gateway instance (deprecated, not recommended to use).
- `authGateway`: Returns the authentication gateway (deprecated, not recommended to use).
- `exchangeGateway`: Returns the exchange gateway (deprecated, not recommended to use).
- `wsGateway`: Returns the WebSocket gateway (deprecated, not recommended to use).
- `exchangeAccount`: Returns the exchange account associated with the API key.

<details>
<summary>exchangeAccount method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const exchangeAccountData = apiKeyAccount.exchangeAccount();
```

<summary>exchangeAccount result example</summary>

```json
{
  "id": "8f0f1f6e-4a6d-4f6a-8e6f-0f6a4f6a8ev",
  "authId": "b6b3a4c6-5a6d-43e6-b6b3-a4c65a6d43e6",
  "exchangeId": 1,
  "name": "John Doe",
  "email": "john.doe@example.com",
  "wallet": "0x1234567890abcdef",
  "social": [
    {
      "type": "twitter",
      "value": "@johndoe"
    },
    {
      "type": "github",
      "value": "johndoe"
    }
  ],
  "avatar": "https://example.com/avatar.jpg",
  "level": 2,
  "locale": "en-US",
  "dateTimeFormat": "MM/DD/YYYY",
  "favoriteInstruments": ["BTCUSDT"],
  "marginCall": false,
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z"
}
```

</details>

- `session`: Returns the session associated with the API key account. In case of api ey account returns api key.

Methods:

- `getBalance`: Returns a new Balance class instance for the API key account.

- `fetchTpSlList`: Fetches a list of Take Profit and Stop Loss (TpSl) orders based on the provided query parameters.

<details>
<summary>fetchTpSlList method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, TpSlType } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const query = {
  instrument: ["BTCUSDT", "ETHUSDT"],
  status: ["active", "pending"],
  type: TpSlType.TakeProfit,
  offset: 0,
  limit: 10,
};
const tpslList = await apiKeyAccount.fetchTpSlList(query);
```

<summary>tpslList result example</summary>

```json
{
  "list": [
    {
      "id": "f47ac10b-58cc-4752-9f6a-8e3f9e7a6c11",
      "instrument": "BTCUSDT",
      "type": "take-profit",
      "side": "BUY",
      "quantity": "0.1",
      "price": "50000.00",
      "status": "active",
      "triggerOrder": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b9d4c22",
      "triggeredQuantity": "0.05",
      "cancelledReason": "",
      "createdAt": "2022-01-01T12:00:00.000Z",
      "updatedAt": "2022-01-15T14:30:00.000Z"
    }
  ]
}
```

</details>

- `fetchMe`: Fetches the current user information.

<details>
<summary>fetchMe method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const userData = await apiKeyAccount.fetchMe();
```

<summary>fetchMe result example</summary>

```json
{
  "id": "8f0f1f6e-4a6d-4f6a-8e6f-0f6a4f6a8ev",
  "authId": "b6b3a4c6-5a6d-43e6-b6b3-a4c65a6d43e6",
  "exchangeId": 1,
  "name": "John Doe",
  "email": "john.doe@example.com",
  "wallet": "0x1234567890abcdef",
  "social": [
    {
      "type": "twitter",
      "value": "@johndoe"
    },
    {
      "type": "github",
      "value": "johndoe"
    }
  ],
  "avatar": "https://example.com/avatar.jpg",
  "level": 2,
  "locale": "en-US",
  "dateTimeFormat": "MM/DD/YYYY",
  "favoriteInstruments": ["BTCUSDT"],
  "marginCall": false,
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z"
}
```

</details>

- `fetchPositions`: Fetches a list of current user positions.

<details>
<summary>fetchPositions method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const positions = await apiKeyAccount.fetchPositions();
```

<summary>fetchPositions result example</summary>

```json
[
  {
    "id": "1-BTCUSDT",
    "user": "1",
    "instrument": "BTCUSDT",
    "side": "buy",
    "quantity": 0.1,
    "avgPrice": 50000.0,
    "fundingRate": 0.01,
    "leverage": 10,
    "maintenanceMargin": 0.05,
    "createdAt": "2022-01-01T12:00:00.000Z",
    "updatedAt": "2022-01-15T14:30:00.000Z",
    "unRealizedPnL": 1000.0,
    "adlLevel": 2
  }
]
```

</details>

- `fetchOrders`: Fetches a list of user orders based on the provided query parameters.

<details>
<summary>fetchOrders method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  Side,
  OrderType,
  OrderGroup,
  OrderStatus,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const orderListQueryParams = {
  instrument: "BTCUSDT",
  status: [OrderStatus.New, OrderStatus.PartiallyFilled],
  group: [OrderGroup.Manually, OrderGroup.TpSl],
  type: [OrderType.Limit, OrderType.Market],
  side: Side.Buy,
  version: 2,
  limit: 10,
  offset: 0,
};

const orderList = await apiKeyAccount.fetchOrders(orderListQueryParams);
```

<summary>fetchOrders result example</summary>

```json
{
  "list": [
    {
      "id": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e6",
      "user": "67890",
      "instrument": "BTCUSDT",
      "side": "BUY",
      "type": "LIMIT",
      "quantity": 0.1,
      "cashQuantity": 5000.0,
      "limitPrice": 50000.0,
      "stopPrice": null,
      "status": "PARTIALLY_FILLED",
      "unFilledQuantity": 0.05,
      "filledAvgPrice": 50050.0,
      "realizedPnL": 100.0,
      "fee": [
        {
          "coin": "USDT",
          "quantity": 10.0
        }
      ],
      "createdAt": "2022-01-01T12:00:00.000Z",
      "updatedAt": "2022-01-15T14:30:00.000Z",
      "triggeredAt": null,
      "group": "manually"
    }
  ],
  "count": 1
}
```

</details>

- `fetchAvailableBalance`: Fetches the available balance for the current user.

<details>
<summary>fetchAvailableBalance method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  Side,
  OrderType,
  OrderGroup,
  OrderStatus,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const availableBalance = await apiKeyAccount.fetchAvailableBalance();
```

<summary>fetchAvailableBalance result example</summary>

```json
{
  "funding": {
    "currency": "USDT",
    "balance": "10000.00"
  },
  "positions": [
    {
      "instrument": "BTCUSDT",
      "side": "buy",
      "volume": "0.1",
      "initialMargin": "500.00"
    },
    {
      "instrument": "ETHUSDT",
      "side": "sell",
      "volume": "1.0",
      "initialMargin": "1000.00"
    }
  ],
  "openOrders": [
    {
      "instrument": "BTCUSDT",
      "side": "buy",
      "unFilledVolume": "0.05",
      "unFilledInitialMargin": "250.00"
    },
    {
      "instrument": "ETHUSDT",
      "side": "sell",
      "unFilledVolume": "0.5",
      "unFilledInitialMargin": "500.00"
    }
  ],
  "availableBalance": "5000.00"
}
```

</details>

- `fetchPower`: Fetches user power for sell and buy sides.

<details>
<summary>fetchPower method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  Side,
  OrderType,
  OrderGroup,
  OrderStatus,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const powerQueryParams = {
  instrument: "BTCUSDT",
};
const power = await apiKeyAccount.fetchPower(powerQueryParams);
```

<summary>fetchPower result example</summary>

```json
{
  "buy": {
    "power": 1000
  },
  "sell": {
    "power": 2000
  }
}
```

</details>

- `fetchOpenOrders`: Fetches a list of open orders for the current user.

<details>
<summary>fetchOpenOrders method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  Side,
  OrderType,
  OrderGroup,
  OrderStatus,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const apiKeyAccount = devContainer.apiKeyAccount("mainApiKey");
const openOrders = await apiKeyAccount.fetchOpenOrders();
```

<summary>fetchOpenOrders result example</summary>

```json
[
  {
    "id": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e6",
    "user": "67890",
    "instrument": "BTCUSDT",
    "side": "BUY",
    "type": "LIMIT",
    "status": "PARTIALLY_FILLED",
    "quantity": 0.1,
    "limitPrice": 50000.0,
    "unFilledQuantity": 0.05,
    "fee": [
      {
        "coin": "USDT",
        "quantity": 10.0
      }
    ],
    "updatedAt": "2022-01-15T14:30:00.000Z",
    "cashQuantity": 5000.0
  }
]
```

</details>

### WalletAccount (extends SessionAccount)

This class extends the SessionAccount class, which extends the ApiKeyAccount.

`WalletAccount` contains `ApiKeyAccount` methods and provides methods for executing various trading actions.

To initialize `WalletAccount` you need to pass your wallet private key to container config.

Class Methods

- `createWithdraw(withdraw)` — method used to create a signed withdrawal request and sends it to the exchange gateway.

<details>
<summary>createWithdraw method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, type TradingBalanceWithdraw } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const withdrawQueryParams: TradingBalanceWithdraw = {
  recipient: "0x1234567890abcdef",
  amount: 100.5,
};
const withdrawResult = await walletAccount.createWithdraw(withdrawQueryParams);
```

<summary>createWithdraw result example</summary>

```json
{
  "id": "123e4567-e89b-12d3-a456-426655440000",
  "user": "f47ac10b-58cc-4372-a567-0e02bdc8d47d",
  "type": "withdraw",
  "coin": "USDT",
  "amount": 100.5,
  "fee": 0.1,
  "status": "pending",
  "createdAt": "2023-02-20T14:30:00.000Z",
  "updatedAt": "2023-02-20T14:30:00.000Z"
}
```

</details>
 
 - `createClosePositionOrder(order)` — method used to creates a signed close position order and sends it to the exchange gateway
 
<details>
<summary>createWithdraw method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, type PositionCloseOrderPayload } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const positionCloseOrderPayload: PositionCloseOrderPayload = {
  instrument: "BTCUSDT",
  leverage: 10,
  quantity: 0.1,
};
const closePositionResult = await walletAccount.createClosePositionOrder(positionCloseOrderPayload);
```

<summary>createClosePositionOrder result example</summary>

```json
{
  "id": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e6",
  "user": "67890",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quantity": 0.1,
  "cashQuantity": 5000.0,
  "limitPrice": null,
  "stopPrice": null,
  "status": "FILLED",
  "unFilledQuantity": 0,
  "filledAvgPrice": 50050.0,
  "realizedPnL": 100.0,
  "fee": [
    {
      "coin": "USDT",
      "quantity": 10.0
    }
  ],
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z",
  "triggeredAt": null,
  "group": "manually"
}
```

</details>
 
 - `updatePosition(query)` — method used to update an open position leverage.
 
<details>
<summary>createWithdraw method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, type PositionUpdateQuery } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const positionUpdatePayload: PositionUpdateQuery = {
  instrument: "BTCUSDT",
  leverage: 20,
};

const updatePositionResult = await walletAccount.updatePosition(positionCloseOrderPayload);
```

<summary>updatePosition result example</summary>

```json
{
  "id": "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  "user": "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1n",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "quantity": 10,
  "avgPrice": 100.0,
  "fundingRate": 0.01,
  "leverage": 20,
  "maintenanceMargin": 1000.0,
  "createdAt": "2023-02-20T14:30:00.000Z",
  "updatedAt": "2023-02-20T14:30:00.000Z"
}
```

</details>
 
- `createLimitOrder(order)` — method used to create a signed limit order and sends it to the exchange gateway.

<details>
<summary>createLimitOrder(order) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type LimitOrderPayload,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const limitOrderPayload: LimitOrderPayload = {
  instrument: "BTCUSDT",
  side: Side.Buy,
  leverage: 10,
  quantity: 0.01,
  limitPrice: 100000,
  tpsl: [
    {
      type: TpSlType.TakeProfit,
      side: Side.Buy,
      quantity: 0.01,
      price: 120000,
    },
    {
      type: TpSlType.StopLoss,
      side: Side.Buy,
      quantity: 0.01,
      price: 80000,
    },
  ],
};
const createLimitOrderResult = await walletAccount.createLimitOrder(limitOrderPayload);
```

<summary>createLimitOrder result example</summary>

```json
{
  "id": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e6",
  "user": "67890",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": 0.01,
  "cashQuantity": 0,
  "limitPrice": 100000,
  "stopPrice": null,
  "status": "NEW",
  "unFilledQuantity": 0.01,
  "filledAvgPrice": 0,
  "realizedPnL": 0,
  "fee": [
    {
      "coin": "USDT",
      "quantity": 10.0
    }
  ],
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z",
  "triggeredAt": null,
  "group": "manually"
}
```

</details>

- `batchCreateLimitOrder(orders)` — method used to create a signed limit order and sends it to the exchange gateway.

<details>
<summary>batchCreateLimitOrder(orders) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type LimitOrderPayload,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const instrument = "BTCUSDT";
const limitOrderPayloads: LimitOrderPayload[] = [
  {
    instrument,
    side: Side.Buy,
    leverage: 10,
    quantity: 0.01,
    limitPrice: 100000,
  },
  {
    instrument,
    side: Side.Buy,
    leverage: 10,
    quantity: 0.02,
    limitPrice: 101000,
  },
];
const batchCreateLimitOrderResult = await walletAccount.batchCreateLimitOrder(instrument, limitOrderPayloads);
```

<summary>batchCreateLimitOrder result example</summary>

```json
[
  {
    "orderId": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e7",
    "success": true
  },
  {
    "orderId": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e8",
    "success": false,
    "failReason": "Insufficient funds"
  }
]
```

</details>
 
- `replaceLimitOrder(order)` — method used to update (replace) an open limit order.
 
<details>
<summary>replaceLimitOrder(order) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type ReplaceLimitOrder,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const replaceLimitOrderPayload: ReplaceLimitOrder = {
  orderId: "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  quantity: 0.02,
  limitPrice: 105000,
};
const replaceLimitOrderResult = await walletAccount.replaceLimitOrder(replaceLimitOrderPayload);
```

<summary>replaceLimitOrder result example</summary>

```json
{
  "id": "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  "user": "67890",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": 0.02,
  "cashQuantity": 0,
  "limitPrice": 105000,
  "stopPrice": null,
  "status": "REPLACED",
  "unFilledQuantity": 0.02,
  "filledAvgPrice": 0,
  "realizedPnL": 0,
  "fee": [
    {
      "coin": "USDT",
      "quantity": 10.0
    }
  ],
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z",
  "triggeredAt": null,
  "group": "manually"
}
```

</details>
 
- `batchReplaceLimitOrder(orderList)` — method used to batch replace open limit orders. **Deprecated, not recommmended to use. Instead use batchReplaceInstrumentLimitOrder method**

- `batchReplaceInstrumentLimitOrder(instrument, orderList)` — method used to batch replace open limit orders.

<details>
<summary>batchReplaceInstrumentLimitOrder(instrument, orderList) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type ReplaceLimitOrder,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const replaceLimitOrderPayloads: ReplaceLimitOrder[] = [
  {
    orderId: "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
    quantity: 0.02,
    limitPrice: 105000,
  },
  {
    orderId: "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1n",
    quantity: 0.01,
    limitPrice: 95000,
  },
];
const batchReplaceInstrumentLimitOrderResult = await walletAccount.batchReplaceInstrumentLimitOrder(
  "BTCUSDT",
  replaceLimitOrderPayloads,
);
```

<summary>batchReplaceInstrumentLimitOrderResult result example</summary>

```json
{}
```

</details>
 
- `createMarketOrder(order)` — method used to create a signed market order.

<details>
<summary>createMarketOrder(order) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type MarketOrderPayload,
  TimeInForce,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const marketOrderPayload: MarketOrderPayload = {
  instrument: "BTCUSDT",
  side: Side.Buy,
  leverage: 10,
  timeInForce: TimeInForce.IOC,
  cashQuantity: 1000,
  tpsl: [
    {
      type: TpSlType.TakeProfit,
      side: Side.Buy,
      quantity: 0.01,
      price: 120000,
    },
    {
      type: TpSlType.StopLoss,
      side: Side.Buy,
      quantity: 0.01,
      price: 80000,
    },
  ],
};
const createMarketOrderResult = await walletAccount.createMarketOrder(marketOrderPayload);
```

<summary>createMarketOrder result example</summary>

```json
{
  "id": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e6",
  "user": "67890",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quantity": 0,
  "cashQuantity": 1000,
  "limitPrice": 0,
  "stopPrice": null,
  "status": "NEW",
  "unFilledQuantity": 0.01,
  "filledAvgPrice": 0,
  "realizedPnL": 0,
  "fee": [
    {
      "coin": "USDT",
      "quantity": 10.0
    }
  ],
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z",
  "triggeredAt": null,
  "group": "manually"
}
```

</details>
 
 - `createStopLimitOrder(order)` — method used to create a stop-limit order.
 
<details>
<summary>createStopLimitOrder(order) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type StopLimitOrderPayload,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const limitOrderPayload: StopLimitOrderPayload = {
  instrument: "BTCUSDT",
  side: Side.Buy,
  leverage: 10,
  quantity: 0.01,
  limitPrice: 100000,
  stopPrice: 100500,
  tpsl: [
    {
      type: TpSlType.TakeProfit,
      side: Side.Buy,
      quantity: 0.01,
      price: 120000,
    },
    {
      type: TpSlType.StopLoss,
      side: Side.Buy,
      quantity: 0.01,
      price: 80000,
    },
  ],
};
const createStopLimitOrderResult = await walletAccount.createStopLimitOrder(limitOrderPayload);
```

<summary>createStopLimitOrder result example</summary>

```json
{
  "id": "a6f1c4e5-3b7d-42e6-b6b3-a4c65a6d43e6",
  "user": "67890",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "type": "STOP_LIMIT",
  "quantity": 0.01,
  "cashQuantity": 0,
  "limitPrice": 100000,
  "stopPrice": 100500,
  "status": "NEW",
  "unFilledQuantity": 0.01,
  "filledAvgPrice": 0,
  "realizedPnL": 0,
  "fee": [
    {
      "coin": "USDT",
      "quantity": 10.0
    }
  ],
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z",
  "triggeredAt": null,
  "group": "manually"
}
```

</details>
 
- `replaceStopLimitOrder(order)` — method used to replace a stop-limit order.

<details>
<summary>replaceStopLimitOrder(order) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type ReplaceStopLimitOrder,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const replaceLimitOrderPayload: ReplaceStopLimitOrder = {
  orderId: "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  quantity: 0.02,
  limitPrice: 105000,
  stopPrice: 105500,
};
const replaceLimitOrderResult = await walletAccount.replaceStopLimitOrder(replaceLimitOrderPayload);
```

<summary>replaceStopLimitOrder result example</summary>

```json
{
  "id": "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  "user": "67890",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": 0.02,
  "cashQuantity": 0,
  "limitPrice": 105000,
  "stopPrice": 105500,
  "status": "REPLACED",
  "unFilledQuantity": 0.02,
  "filledAvgPrice": 0,
  "realizedPnL": 0,
  "fee": [
    {
      "coin": "USDT",
      "quantity": 10.0
    }
  ],
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z",
  "triggeredAt": null,
  "group": "manually"
}
```

</details>

- `cancelOrder(query)` — method used to cancel an order.

<details>
<summary>cancelOrder(query) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, type OrderCancelQuery } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const cancelOrderPayload: OrderCancelQuery = {
  orderId: "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
};
const cancelOrderResult = await walletAccount.cancelOrder(cancelOrderPayload);
```

<summary>cancelOrder result example</summary>

```json
{}
```

</details>
 
- `massCancelUserOrdersById(query)` — method used to cancel user orders by ids.

<details>
<summary>massCancelUserOrdersById(query) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, type OrderMassCancelByIdQuery } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const massCancelUserOrdersByIdParams: OrderMassCancelByIdQuery = {
  orderIds: ["4f6c21a4-3c4f-4f2e-8f6d-5b4c7a9d2e1f", "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f"],
};
const massCancelUserOrdersResult = await walletAccount.massCancelUserOrdersById(
  massCancelUserOrdersByIdParams,
);
```

<summary>massCancelUserOrdersById result example</summary>

```json
{}
```

</details>

- `massCancelUserOrders(query)` — method used to cancel user orders by instrument.

<details>
<summary>massCancelUserOrders(query) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, type OrderMassCancelQuery } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const massCancelUserOrdersParams: OrderMassCancelQuery = {
  instrument: "BTCUSDT",
};
const massCancelUserOrdersResult = await walletAccount.massCancelUserOrders(
  massCancelUserOrdersParams,
);
```

<summary>massCancelUserOrders result example</summary>

```json
{}
```

</details>

- `createTpSl(tpsl)` — method used to create Take Profit/Stop Loss orders.

<details>
<summary>createTpSl(tpsl) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type TpSlCreatePayload,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const tpslPayload: TpSlCreatePayload = {
  type: TpSlType.TakeProfit,
  side: Side.Buy,
  quantity: 0.01,
  price: 120000,
  order: "4f6c21a4-3c4f-4f2e-8f6d-5b4c7a9d2e1f",
  instrument: "BTCUSDT",
};
const createTpSlResult = await walletAccount.createTpSl(tpslPayload);
```

<summary>createTpSl result example</summary>

```json
{
  "id": "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  "instrument": "BTCUSD",
  "type": "take-profit",
  "side": "BUY",
  "quantity": "0.01",
  "price": "120000",
  "status": "waitOrder",
  "triggerOrder": null,
  "triggeredQuantity": "0",
  "cancelledReason": "",
  "createdAt": "2023-02-20T14:30:00.000Z",
  "updatedAt": "2023-02-20T14:30:00.000Z"
}
```

</details>
 
- `updateTpSl(query)` — method used to update Take Profit/Stop Loss orders.

<details>
<summary>updateTpSl(query) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import {
  Environment,
  Container,
  type TpSlUpdateQuery,
  Side,
  TpSlType,
} from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const tpslUpdatePayload: TpSlUpdateQuery = {
  type: TpSlType.TakeProfit,
  side: Side.Buy,
  quantity: 0.01,
  price: 121000,
  order: "4f6c21a4-3c4f-4f2e-8f6d-5b4c7a9d2e1f",
  instrument: "BTCUSDT",
  id: "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
};
const updateTpSlResult = await walletAccount.updateTpSl(tpslUpdatePayload);
```

<summary>updateTpSl result example</summary>

```json
{
  "id": "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  "instrument": "BTCUSD",
  "type": "take-profit",
  "side": "BUY",
  "quantity": "0.01",
  "price": "121000",
  "status": "waitOrder",
  "triggerOrder": null,
  "triggeredQuantity": "0",
  "cancelledReason": "",
  "createdAt": "2023-02-20T14:30:00.000Z",
  "updatedAt": "2023-02-20T14:30:00.000Z"
}
```

</details>

- `cancelTpSl(query)` — method used to cancel Take Profit/Stop Loss orders.

<details>
<summary>cancelTpSl(query) method usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, type TpSlCancelQuery } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);
const walletAccount = devContainer.account("myWallet");
const tpslCancelPayload: TpSlCancelQuery = {
  instrument: "BTCUSDT",
  id: "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
};
const cancelTpSlResult = await walletAccount.cancelTpSl(tpslCancelPayload);
```

<summary>cancelTpSl result example</summary>

```json
{
  "id": "a8f5e2b4-4c9a-4e3a-8f6d-5b4c7a9d2e1f",
  "instrument": "BTCUSD",
  "type": "take-profit",
  "side": "BUY",
  "quantity": "0.01",
  "price": "121000",
  "status": "cancelled",
  "triggerOrder": null,
  "triggeredQuantity": "0",
  "cancelledReason": "",
  "createdAt": "2023-02-20T14:30:00.000Z",
  "updatedAt": "2023-02-20T14:30:00.000Z"
}
```

</details>

### Balance

This class used to get realtime available balance and power data and handle exchange events.

- `constructor(options: BalanceOptions)` — method used to create a `Balance` instance.

<details>
<summary>Init Balance usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

// using wallet account

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

// or using api key account

const apiKeyAccount = await devContainer.apiKeyAccount("mainApiKey");

const balanceFromApiKeyAccount = apiKeyAccount.getBalance();
```

</details>

- `listen()` - method used to subscribe to the exchange events and fill balance state. Returns Balance class instance

<details>
<summary>listen() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();
```

</details>

- `unListen()` - method used to unsubscribe to the exchange events and reset balance state. Returns Balance class instance

<details>
<summary>unListen() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

await balance.unListen();
```

</details>

- `getFundingQuantity(currency)` — method used to get current funding of the Balance.

<details>
<summary>getFundingQuantity() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, CollateralCurrency } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const funding = balance.getFundingQuantity(CollateralCurrency.USDT); // Example: returns "1000"
```

</details>

- `getWithdrawTransferPendingQuantity()` — method that returns sum of pending withdraw transfers.

<details>
<summary>getWithdrawTransferPendingQuantity() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, CollateralCurrency } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const withdrawPendingTrasferAmount = balance.getWithdrawTransferPendingQuantity(
  CollateralCurrency.USDT,
); // Example: returns Big instance
```

</details>

- `getPositionList()` — method that returns all positions of the Balance.

<details>
<summary>getPositionList() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container, CollateralCurrency } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const positions = balance.getPositionList();
```

<summary>getPositionList result example</summary>

```json
[
  {
    "id": "1-BTCUSDT",
    "user": "johnDoe",
    "instrument": "BTCUSDT",
    "side": "BUY",
    "quantity": 0.1,
    "avgPrice": 50000,
    "fundingRate": 0.01,
    "leverage": 5,
    "maintenanceMargin": 100,
    "createdAt": "2022-01-01T12:00:00.000Z",
    "updatedAt": "2022-01-01T12:00:00.000Z"
  }
]
```

</details>
 
 - `getPosition(instrument)` — method that returns user position by instrument.
 
<details>
<summary>getPosition(instrument) usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const position = balance.getPosition("BTCUSDT");
```

<summary>getPosition result example</summary>

```json
{
  "id": "1-BTCUSDT",
  "user": "johnDoe",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "quantity": 0.1,
  "avgPrice": 50000,
  "fundingRate": 0.01,
  "leverage": 5,
  "maintenanceMargin": 100,
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-01T12:00:00.000Z"
}
```

</details>
 
- `getOrderList()` — method that returns the list of existing orders.

<details>
<summary>getOrderList() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const orderList = balance.getOrderList();
```

<summary>getOrderList() result example</summary>

```json
[
  {
    "id": "9fcbf9d3-4a3d-4a6b-8a6f-5f4c9d3a1b2c",
    "user": "1",
    "instrument": "BTCUSDT",
    "side": "BUY",
    "type": "LIMIT",
    "status": "NEW",
    "quantity": 0.1,
    "limitPrice": 50000,
    "unFilledQuantity": 0.1,
    "fee": [
      {
        "coin": "USDT",
        "quantity": 10.0
      }
    ],
    "updatedAt": "2022-01-01T12:00:00.000Z",
    "cashQuantity": 0
  }
]
```

</details>
 
 - `getTpSlList()` — method that returns existing Take Profit/Stop Loss orders.

<details>
<summary>getTpSlList() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const tpSlList = balance.getTpSlList();
```

<summary>getTpSlList() result example</summary>

```json
[
  {
    "id": "f47ac10b-58cc-4752-9f6a-8e3f9e7a6c11",
    "instrument": "BTCUSDT",
    "type": "take-profit",
    "side": "BUY",
    "quantity": "0.1",
    "price": "50000.00",
    "status": "active",
    "triggerOrder": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b9d4c22",
    "triggeredQuantity": "0.05",
    "cancelledReason": "",
    "createdAt": "2022-01-01T12:00:00.000Z",
    "updatedAt": "2022-01-15T14:30:00.000Z"
  }
]
```

</details>

- `getAvailableBalance()` — method that returns available balance of the account, existing positions and open orders.

<details>
<summary>getAvailableBalance() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const availableBalance = balance.getAvailableBalance();
```

<summary>getAvailableBalance() result example</summary>

```json
{
  "funding": {
    "currency": "USDT",
    "balance": "10000.00"
  },
  "positions": [
    {
      "instrument": "BTCUSDT",
      "side": "buy",
      "volume": "0.1",
      "initialMargin": "500.00"
    },
    {
      "instrument": "ETHUSDT",
      "side": "sell",
      "volume": "1.0",
      "initialMargin": "1000.00"
    }
  ],
  "openOrders": [
    {
      "instrument": "BTCUSDT",
      "side": "buy",
      "unFilledVolume": "0.05",
      "unFilledInitialMargin": "250.00"
    },
    {
      "instrument": "ETHUSDT",
      "side": "sell",
      "unFilledVolume": "0.5",
      "unFilledInitialMargin": "500.00"
    }
  ],
  "availableBalance": "5000.00"
}
```

</details>
 
 - `getPower(instrument)` — method that returns current buying and selling power (the maximum available order value).
 
<details>
<summary>getPower(instrument) usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

const power = balance.getPower("BTCUSDT");
```

<summary>getPower(instrument) result example</summary>

```json
{
  "buy": 1000,
  "sell": 1500
}
```

</details>

Signals:

Balance class instance can handle realtime events from exchange recieved by websocket using signals.

- `onAccountUpdate()` — signal of updating user data

<details>
<summary>onAccountUpdate() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

balance.onAccountUpdate((accountState) => console.log(accountState));
```

<summary>onAccountUpdate() event payload example</summary>

```json
{
  "id": "8f0f1f6e-4a6d-4f6a-8e6f-0f6a4f6a8ev",
  "authId": "b6b3a4c6-5a6d-43e6-b6b3-a4c65a6d43e6",
  "exchangeId": 1,
  "name": "John Doe",
  "email": "john.doe@example.com",
  "wallet": "0x1234567890abcdef",
  "social": [
    {
      "type": "twitter",
      "value": "@johndoe"
    },
    {
      "type": "github",
      "value": "johndoe"
    }
  ],
  "avatar": "https://example.com/avatar.jpg",
  "level": 2,
  "locale": "en-US",
  "dateTimeFormat": "MM/DD/YYYY",
  "favoriteInstruments": ["BTCUSDT"],
  "marginCall": false,
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z"
}
```

</details>

- `onFundingUpdate()` — signal of updating user data

<details>
<summary>onFundingUpdate() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

balance.onFundingUpdate((fundingState) => console.log(fundingState));
```

<summary>onFundingUpdate() event payload example</summary>

```json
{
  "coin": "BTC",
  "quantity": 0.5,
  "updatedAt": "2022-01-01T12:00:00.000Z"
}
```

</details>

- `onTransferUpdate()` — signal of updating user transfers data

<details>
<summary>onTransferUpdate() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

balance.onTransferUpdate((transferState) => console.log(transferState));
```

<summary>onTransferUpdate() event payload example</summary>

```json
{
  "id": "8b6e9f4c-4a3d-4f6b-8a6f-5f4c9d3a1b2c",
  "user": "1",
  "type": "withdraw",
  "coin": "BTC",
  "amount": 0.5,
  "fee": 0.001,
  "status": "pending",
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-01T12:00:00.000Z"
}
```

</details>

- `onPositionUpdate()` — signal of updating user positions data

<details>
<summary>onPositionUpdate() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

balance.onPositionUpdate((positionState) => console.log(positionState));
```

<summary>onPositionUpdate() event payload example</summary>

```json
{
  "id": "1-BTCUSDT",
  "user": "1",
  "instrument": "BTCUSDT",
  "side": "buy",
  "quantity": 0.1,
  "avgPrice": 50000.0,
  "fundingRate": 0.01,
  "leverage": 10,
  "maintenanceMargin": 0.05,
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z",
  "unRealizedPnL": 1000.0,
  "adlLevel": 2
}
```

</details>

- `onOrderUpdate()` — signal of updating user orders data

<details>
<summary>onOrderUpdate() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

balance.onOrderUpdate((orderState) => console.log(orderState));
```

<summary>onOrderUpdate() event payload example</summary>

```json
{
  "id": "9fcbf9d3-4a3d-4a6b-8a6f-5f4c9d3a1b2c",
  "user": "1",
  "instrument": "BTCUSDT",
  "side": "BUY",
  "type": "LIMIT",
  "status": "NEW",
  "quantity": 0.1,
  "limitPrice": 50000,
  "unFilledQuantity": 0.1,
  "fee": [
    {
      "coin": "USDT",
      "quantity": 10.0
    }
  ],
  "updatedAt": "2022-01-01T12:00:00.000Z",
  "cashQuantity": 0
}
```

</details>

- `onTpSlUpdate()` — signal of updating user tpsl data

<details>
<summary>onTpSlUpdate() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

balance.onTpSlUpdate((tpslState) => console.log(tpslState));
```

<summary>onTpSlUpdate() event payload example</summary>

```json
{
  "id": "f47ac10b-58cc-4752-9f6a-8e3f9e7a6c11",
  "instrument": "BTCUSDT",
  "type": "take-profit",
  "side": "BUY",
  "quantity": "0.1",
  "price": "50000.00",
  "status": "active",
  "triggerOrder": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b9d4c22",
  "triggeredQuantity": "0.05",
  "cancelledReason": "",
  "createdAt": "2022-01-01T12:00:00.000Z",
  "updatedAt": "2022-01-15T14:30:00.000Z"
}
```

</details>

- `onMarkPriceUpdate()` — signal of updating user mark price data

<details>
<summary>onMarkPriceUpdate() usage example</summary>

```typescript
import { WebSocket } from "ws";
import { Environment, Container } from "@evedex/exchange-bot-sdk";

const config = {
  environment: Environment.DEV,
  centrifugeWebSocket: WebSocket,
  wallets: {
    myWallet: {
      privateKey: "your-private-key",
    },
  },
  apiKeys: {
    mainApiKey: {
      apiKey: "your-api-key",
    },
  },
};

const devContainer = new Container(config);

const walletAccount = await devContainer.account("myWallet");

const balance = walletAccount.getBalance();

await balance.listen();

balance.onMarkPriceUpdate((markPriceState) => console.log(markPriceState));
```

<summary>onMarkPriceUpdate() event payload example</summary>

```json
{
  "markPrice": 50000,
  "updatedAt": "2022-01-01T12:00:00.000Z",
  "name": "BTCUSDT"
}
```

</details>
