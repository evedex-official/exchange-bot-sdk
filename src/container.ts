import { WalletAccount, Gateway } from "./gateway";
import { Wallet, WalletOptions } from "./utils";

export class WalletNotFoundError extends Error {
  constructor(walletName: string) {
    super(`Wallet "${walletName}" not found`);
  }
}

export interface ContainerConfig {
  exchangeURI: string;
  authURI: string;
  centrifugeURI: string;
  centrifugePrefix: string;
  wallets: Record<string, WalletOptions>;
}

export class Container {
  private readonly accountsPool = new Map<string, Promise<WalletAccount>>();

  constructor(public config: ContainerConfig) {}

  gateway() {
    return new Gateway({
      authURI: this.config.authURI,
      exchangeURI: this.config.exchangeURI,
      centrifuge: {
        uri: this.config.centrifugeURI,
        prefix: this.config.centrifugePrefix,
      },
    });
  }

  wallet(walletName: string) {
    const walletConfig = this.config.wallets[walletName];
    if (!walletConfig) throw new WalletNotFoundError(walletName);

    return new Wallet(walletConfig);
  }

  account(walletName: string) {
    let account = this.accountsPool.get(walletName);
    if (!account) {
      account = this.gateway().signInWalletAccount(this.wallet(walletName), "exchange-bot-sdk");
      this.accountsPool.set(walletName, account);
    }

    return account;
  }
}
