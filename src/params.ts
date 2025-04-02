export interface GatewayParams {
  exchangeURI: string;
  authURI: string;
  centrifugeURI: string;
  centrifugePrefix: string;
}

export enum Environment {
  DEV = "dev",
  DEMO = "demo",
  PROD = "prod",
}

export const GatewayParamsMap = new Map<Environment, GatewayParams>([
  [
    Environment.DEV,
    {
      exchangeURI: "https://exchange.evedex.tech",
      authURI: "https://auth.evedex.tech",
      centrifugeURI: "wss://ws.evedex.tech/connection/websocket",
      centrifugePrefix: "futures-perp-dev",
    },
  ],
  [
    Environment.DEMO,
    {
      exchangeURI: "https://demo-exchange-api.evedex.com",
      authURI: "https://auth.evedex.com",
      centrifugeURI: "wss://ws.evedex.com/connection/websocket",
      centrifugePrefix: "futures-perp-demo",
    },
  ],
  [
    Environment.PROD,
    {
      exchangeURI: "https://exchange-api.evedex.com",
      authURI: "https://auth.evedex.com",
      centrifugeURI: "wss://stream.evedex.com/connection/websocket",
      centrifugePrefix: "futures-perp",
    },
  ],
]);
