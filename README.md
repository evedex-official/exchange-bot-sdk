# exchange-bot-sdk

## Установка
1. Добавить в проект файл .npmrc следующего содержания
```
@eventhorizon:registry=https://gitlab.eventhorizon.life/api/v4/groups/59/-/packages/npm/
```
2. npm i @eventhorizon/exchange-bot-sdk

## Конфигурация

### DEVELOPMENT ENVIRONMENT
```
  const container = new evedexSdk.Container({
    exchangeURI: "https://exchange.evedex.tech",
    authURI:  "https://auth.evedex.tech",
    centrifugeURI: "wss://stream.evedex.tech/connection/websocket",
    centrifugePrefix: "futures-perp-dev",
    centrifugeWebSocket: WebSocket,
    wallets: {
      baseAccount: {
        privateKey: "0x...",
        chain: "16182",
      },
    },
  });
```

### DEMO TRADING ENVIRONMENT
```
  const container = new evedexSdk.Container({
    exchangeURI: "https://demo-exchange-api.evedex.com",
    authURI:  "https://auth.evedex.com",
    centrifugeURI: "wss://stream.evedex.com/connection/websocket",
    centrifugePrefix: "futures-perp-demo",
    centrifugeWebSocket: WebSocket,
    wallets: {
      baseAccount: {
        privateKey: "0x...",
        chain: "16182",
      },
    },
  });
```

### PRODUCTION ENVIRONMENT
```
  const container = new evedexSdk.Container({
    exchangeURI: "https://exchange-api.evedex.com",
    authURI:  "https://auth.evedex.com",
    centrifugeURI: "wss://stream.evedex.com/connection/websocket",
    centrifugePrefix: "futures-perp",
    centrifugeWebSocket: WebSocket,
    wallets: {
      baseAccount: {
        privateKey: "0x...",
        chain: "161803",
      },
    },
  });
```

## Инициализация

Для взаимодействия с открытыми методами биржи, используется экземпляр класса `Gateway`, принимающий следующие опции инициализации:

- `httpClient` - экземпляр HTTP-клиента или сессия (будет использован клиент по умолчанию)
- `centrifuge` - экземпляр Centrifugo-клиента или конфигурация соединения (будет использован клиент по умолчанию)
- `exchangeURI` - URI биржи
- `authURI` - URI сервиса аутентификации

Пример использования:

```ts
import * as evedexSdk from "@eventhorizon/exchange-bot-sdk";

const gateway = new evedexSdk.Gateway({
  httpClient: {},
  centrifuge: {
    uri: "wss://stream.evedex.tech/connection/websocket",
    prefix: "futures-perp-dev",
    websocket: WebSocket, // конструктор websocket клиента, используемого в данном окружении
  },
  exchangeURI: "https://exchange.evedex.tech",
  authURI: "https://auth.evedex.tech",
});

gateway.onOrderBookBestUpdate((bestPrices) => console.info(bestPrices));
gateway.listenOrderBookBest("DBTCUSDT");
```

## Аккаунт пользователя

Если требуется получить данные о конкретном пользователе, используется экземпляр одного из следующих классов:

- `ApiKeyAccount` - только чтение информации о текущем состоянии пользовательского аккаунта
- `SessionAccount` - расширение `WalletAccount`, предоставляющее информацию об аккаунте авторизации пользователя
- `WalletAccount` - расширение `SessionAccount`, позволяющее выполнять действия над аккаунтом пользователя (создавать заявки, изменять позиции, выводить средства с торгового счета и тд.)

Каждый из перечисленных классов использует различные механизмы для авторизации. Создание экземпляров этих классов осуществляется с помощью соответствующих методов класса `Gateway`.

### Api key Account

Данный тип аккаунта использует Api key в качестве сессии.

Пример использования:

```ts
import * as evedexSdk from "@eventhorizon/exchange-bot-sdk";

const gateway = new evedexSdk.Gateway({ ... });

const apiKey = 'cUxD***uOUQ='; // Api key hash
const apiKeyAccount = await gateway.createApiKeyAccount(apiKey)

const accountBalance = apiKeyAccount.getBalance();
accountBalance.onPositionUpdate((position) => console.info(position));
accountBalance.listen();
```

### Session Account

Данный тип аккаунта использует JWT в качестве сессии. При этом токен может быть передан аккаунту непосредственно, либо осуществлена авторизация пользователя с использованием метода `SIWE` сервиса авторизации.

Пример использования:

```ts
import * as evedexSdk from "@eventhorizon/exchange-bot-sdk";

const gateway = new evedexSdk.Gateway({ ... });

const authUser = {...}:
const accessToken = '...';
const refreshToken = '...';
const sessionAccount = await gateway.createSessionAccount({ user: authUser, token: { accessToken, refreshToken }});
// or
const address = '...';
const message = '...';
const signature = '...';
const sessionAccount = await gateway.signInSessionAccount({ address, message, signature });

const accountBalance = sessionAccount.getBalance();
accountBalance.onPositionUpdate((position) => console.info(position));
accountBalance.listen();
```

### Wallet Account

Данный тип аккаунта использует Wallet клиент, для авторизации и JWT в качестве сессии. Этот аккаунт позволяет не только получать информацию об аккаунте, но и создавать заявки на бирже.

Пример использования:

```ts
import * as evedexSdk from "@eventhorizon/exchange-bot-sdk";

const gateway = new evedexSdk.Gateway({ ... });

const privateKey = '...';
const wallet = new Wallet({
    privateKey,
    chain: '16182', // так же может использоваться rpc-провайдер для автоматического определения chainId
});
const message = '...'; // любое сообщение для авторизации с помощью SIWE
const walletAccount = await gateway.signInWalletAccount(wallet, message);

const accountBalance = walletAccount.getBalance();
accountBalance.onPositionUpdate((position) => console.info(position));
accountBalance.listen();

await walletAccount.createLimitOrder({
    // опции новой limit заявки
});
```

## Контейнер

Для упрощения доступа к SDK может использоваться экземпляр класса `Container`, хранящий конфигурации и зависимости.

Пример использования:

```ts
import * as evedexSdk from "@eventhorizon/exchange-bot-sdk";

const container = new evedexSdk.Container({
  exchangeURI: "...",
  authURI: "...",
  centrifugeURI: "...",
  centrifugePrefix: "...",
  centrifugeWebSocket: WebSocket,
  wallets: {
    baseAccount: {
      privateKey: "...",
      chain: "16182",
    },
  },
});

const gateway = container.gateway();
const baseWallet = container.wallet("baseAccount");
const baseWalletAccount = await container.account("baseAccount");

const accountBalance = baseWalletAccount.getBalance();
accountBalance.onPositionUpdate((position) => console.info(position));
accountBalance.listen();
```
