import { ApiKeyAccount, WalletAccount, Gateway } from "./gateway";
import { GatewayParamsMap, Environment, GatewayParams } from "./params";
import type { ApiKey } from "./types";
import { Wallet, Factory, singleton } from "./utils";

export class WalletNotFoundError extends Error {
  constructor(walletName: string) {
    super(`Wallet "${walletName}" not found`);
  }
}

export class ApiKeyNotFoundError extends Error {
  constructor(apiKeyName: string) {
    super(`API key "${apiKeyName}" not found`);
  }
}

export interface WalletConfig {
  privateKey: string;
}

export interface ContainerConfig {
  environment: Environment;
  centrifugeWebSocket?: any;
  wallets: Record<string, WalletConfig>;
  apiKeys: Record<string, ApiKey>;
}

export class Container {
  private readonly accountsPool = new Map<string, Promise<WalletAccount>>();

  private readonly apiKeysPool = new Map<string, Promise<ApiKeyAccount>>();

  readonly gateway: Factory<Gateway> = singleton(
    () =>
      new Gateway({
        authURI: this.gatewayParams.authURI,
        exchangeURI: this.gatewayParams.exchangeURI,
        centrifuge: {
          uri: this.gatewayParams.centrifugeURI,
          prefix: this.gatewayParams.centrifugePrefix,
          websocket: this.config.centrifugeWebSocket,
        },
      }),
  );

  private readonly gatewayParams: GatewayParams;

  constructor(public config: ContainerConfig) {
    this.gatewayParams =
      GatewayParamsMap.get(config.environment) ??
      (GatewayParamsMap.get(Environment.DEV) as GatewayParams);
  }

  wallet(walletName: string) {
    const { privateKey: walletPrivateKey } = this.config.wallets[walletName];
    if (!walletPrivateKey) throw new WalletNotFoundError(walletName);

    return new Wallet({ privateKey: walletPrivateKey, chain: this.gatewayParams.chainId });
  }

  account(walletName: string) {
    let account = this.accountsPool.get(walletName);
    if (!account) {
      account = this.gateway().signInWalletAccount(this.wallet(walletName));
      this.accountsPool.set(walletName, account);
    }

    return account;
  }

  apiKey(apiKeyName: string) {
    const userApiKey = this.config.apiKeys[apiKeyName];
    if (!userApiKey) throw new ApiKeyNotFoundError(apiKeyName);

    return userApiKey;
  }

  apiKeyAccount(apiKeyName: string) {
    let apiKeyAccount = this.apiKeysPool.get(apiKeyName);
    if (!apiKeyAccount) {
      apiKeyAccount = this.gateway().createApiKeyAccount(this.apiKey(apiKeyName));
      this.apiKeysPool.set(apiKeyName, apiKeyAccount);
    }

    return apiKeyAccount;
  }
}

type ClientConfig = Pick<ContainerConfig, "centrifugeWebSocket" | "wallets" | "apiKeys">;

export class ProdContainer extends Container {
  constructor(config: ClientConfig) {
    super({ ...config, environment: Environment.PROD });
  }
}

export class DemoContainer extends Container {
  constructor(config: ClientConfig) {
    super({ ...config, environment: Environment.DEMO });
  }
}

export class DevContainer extends Container {
  constructor(config: ClientConfig) {
    super({ ...config, environment: Environment.DEV });
  }
}
