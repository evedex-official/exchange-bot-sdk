# exchange-bot-sdk

## Установка

1. Добавить в проект файл .npmrc следующего содержания

```
@eventhorizon:registry=https://gitlab.eventhorizon.life/api/v4/groups/59/-/packages/npm/
```

2. npm i @eventhorizon/exchange-bot-sdk

## Инициализация сдк

### DEVELOPMENT ENVIRONMENT

```ts
const container = new evedexSdk.DevContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {
    baseAccount: {
      privateKey: "0x...",
    },
  },
  apiKeys: {},
});
```

### DEMO TRADING ENVIRONMENT

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

### PRODUCTION ENVIRONMENT

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

const container = new evedexSdk.DevContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {},
  apiKeys: {
    mainApiKey: {
      apiKey: "cUxD***uOUQ=",
    },
  },
});

const account = await container.apiKeyAccount("mainApiKey");

console.info("userData", await account.fetchMe());

const accountBalance = account.getBalance();

accountBalance.onPositionUpdate((position) => console.info(position));
accountBalance.listen();
```

### Wallet Account

Данный тип аккаунта использует JWT в качестве сессии. При этом токен может быть передан аккаунту непосредственно, либо осуществлена авторизация пользователя с использованием метода `SIWE` сервиса авторизации.

Пример использования:

```ts
import * as evedexSdk from "@eventhorizon/exchange-bot-sdk";

const container = new evedexSdk.DevContainer({
  centrifugeWebSocket: WebSocket,
  wallets: {
    baseAccount: {
      privateKey: "0x...",
    },
  },
});

const account = await container.account("baseAccount");

const accountBalance = account.getBalance();

accountBalance.onAccountUpdate((state) =>
  console.info(`Account margin call = ${state.marginCall}; last update = ${state.updatedAt}`),
);
accountBalance.onFundingUpdate((state) => console.info(`Funding = ${state.quantity} USDT`));
accountBalance.onPositionUpdate((state) =>
  console.info(
    `Position ${state.instrument} qty = ${state.quantity}; avgPrice = ${state.avgPrice}`,
  ),
);
await accountBalance.listen();

console.info("Available balance from calculate method", await accountBalance.getAvailableBalance());
```
