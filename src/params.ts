export interface GatewayParams {
  exchangeURI: string;
  authURI: string;
  centrifugeURI: string;
  centrifugePrefix: string;
  chainId: string;
}

export enum Environment {
  LOCAL = "local",
  DEV = "dev",
  DEMO = "demo",
  PROD = "prod",
}

export const GatewayParamsMap = new Map<Environment, GatewayParams>([
  [
    Environment.LOCAL,
    {
      exchangeURI: "https://exchange-local.eh-dev.app",
      authURI: "https://auth-local.eh-dev.app",
      centrifugeURI: "wss://centrifugo-local.eh-dev.app",
      centrifugePrefix: "futures-perp",
      chainId: "16182",
    },
  ],
  [
    Environment.DEV,
    {
      exchangeURI: "https://trading-api.evedex.tech",
      authURI: "https://auth-api.evedex.tech",
      centrifugeURI: "wss://ws.evedex.tech/connection/websocket",
      centrifugePrefix: "futures-perp-dev",
      chainId: "16182",
    },
  ],
  [
    Environment.DEMO,
    {
      exchangeURI: "https://demo-exchange-api.evedex.com",
      authURI: "https://auth-api.evedex.com",
      centrifugeURI: "wss://ws.evedex.com/connection/websocket",
      centrifugePrefix: "futures-perp-demo",
      chainId: "16182",
    },
  ],
  [
    Environment.PROD,
    {
      exchangeURI: "https://exchange-api.evedex.com",
      authURI: "https://auth-api.evedex.com",
      centrifugeURI: "wss://ws.evedex.com/connection/websocket",
      centrifugePrefix: "futures-perp",
      chainId: "161803",
    },
  ],
]);
