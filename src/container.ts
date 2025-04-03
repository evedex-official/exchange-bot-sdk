import { WalletAccount, Gateway } from "./gateway";
import { GatewayParamsMap, Environment, GatewayParams } from "./params";
import { Wallet, Factory, singleton } from "./utils";

export class WalletNotFoundError extends Error {
  constructor(walletName: string) {
    super(`Wallet "${walletName}" not found`);
  }
}

export interface ContainerConfig {
  environment: Environment;
  centrifugeWebSocket?: any;
  wallets: Record<string, string>;
}

export class Container {
  private readonly accountsPool = new Map<string, Promise<WalletAccount>>();

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
    const walletPrivateKey = this.config.wallets[walletName];
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
}

type ClientConfig = Pick<ContainerConfig, "centrifugeWebSocket" | "wallets">;

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
