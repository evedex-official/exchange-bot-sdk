export interface GatewayParams {
  exchangeURI: string;
  authURI: string;
  centrifugeURI: string;
  centrifugePrefix: string;
  chainId: string;
}

export enum Environment {
  LOCAL = "local",
  DOCKER = "docker",
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
    Environment.DOCKER,
    {
      exchangeURI: "http://exchange-backend:8080",
      authURI: "http://auth-backend:8080",
      centrifugeURI: "ws://centrifugo",
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
      exchangeURI: "https://trading-api.evedex.io",
      authURI: "https://auth-api.evedex.io",
      centrifugeURI: "wss://ws.evedex.io/connection/websocket",
      centrifugePrefix: "futures-perp-beta",
      chainId: "16182",
    },
  ],
  [
    Environment.PROD,
    {
      exchangeURI: "https://trading-api.evedex.com",
      authURI: "https://auth-api.evedex.com",
      centrifugeURI: "wss://ws.evedex.com/connection/websocket",
      centrifugePrefix: "futures-perp",
      chainId: "161803",
    },
  ],
]);
