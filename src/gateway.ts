import * as evedexCrypto from "@eventhorizon/exchange-crypto";
import * as evedexApi from "@eventhorizon/exchange-api";
import { RestClient } from "./utils/rest";
import { Wallet } from "./utils/wallet";
import { CentrifugeClient, CentrifugeSubscription } from "./utils/ws";
import { Centrifuge, Options as CentrifugeOptions } from "centrifuge";
import { SiweMessage } from "siwe";
import { CollateralCurrency } from "./utils/types";
import Big from "big.js";
import { generateShortUuid } from "./utils";

export interface GatewayOptions {
  httpClient?:
    | RestClient
    | {
        jwt?: evedexApi.utils.JWT | evedexApi.utils.RefreshedJWT;
      };
  exchangeURI: string;
  authURI: string;
  centrifuge:
    | CentrifugeClient
    | {
        uri: string;
        prefix: string;
        websocket?: any;
      };
}

export class Gateway {
  private readonly httpClient: RestClient;

  private readonly centrifugeClient: CentrifugeClient;

  public readonly authGateway: evedexApi.AuthRestGateway;

  public readonly exchangeGateway: evedexApi.ExchangeRestGateway;

  public readonly wsGateway: evedexApi.ExchangeWsGateway;

  public readonly onRecover = evedexApi.utils.signal<CentrifugeSubscription>();

  constructor(public readonly options: Readonly<GatewayOptions>) {
    this.httpClient =
      options.httpClient instanceof RestClient
        ? options.httpClient
        : new RestClient({
            session: options.httpClient?.jwt,
          });
    this.authGateway = new evedexApi.AuthRestGateway({
      authURI: options.authURI,
      httpClient: this.httpClient,
    });
    this.httpClient.setAuthGateway(this.authGateway);
    this.exchangeGateway = new evedexApi.ExchangeRestGateway({
      exchangeURI: options.exchangeURI,
      httpClient: this.httpClient,
    });

    this.centrifugeClient =
      options.centrifuge instanceof CentrifugeClient
        ? options.centrifuge
        : new CentrifugeClient(
            new Centrifuge(
              options.centrifuge.uri,
              options.centrifuge.websocket ? { websocket: options.centrifuge.websocket } : {},
            ),
            options.centrifuge.prefix,
          );
    this.centrifugeClient.onRecover((channel) => this.onRecover(channel));
    this.centrifugeClient.connect();
    this.wsGateway = new evedexApi.ExchangeWsGateway({
      wsClient: this.centrifugeClient,
    });

    this.wsGateway.onMatcherUpdate((matcherState) => this.updateMatcherState(matcherState));
    this.wsGateway.onOrderBookBestUpdate((orderBook) => this.updateOrderBookBest(orderBook));
    this.wsGateway.onOrderBookUpdate((orderBook) => this.updateOrderBook(orderBook));
    this.wsGateway.onTrade((trade) => this.updateTrade(trade));
  }

  get session() {
    return this.httpClient.getSession();
  }

  private lastMatcherStateTime?: Date;

  protected updateMatcherState(matcherState: evedexApi.MatcherUpdateEvent) {
    if (
      this.lastMatcherStateTime &&
      this.lastMatcherStateTime >= new Date(matcherState.updatedAt)
    ) {
      return;
    }

    this.lastMatcherStateTime = new Date(matcherState.updatedAt);
    this.onMatcherState(matcherState);
  }

  private lastOrderBookBestTime = new Map<string, number>();

  protected updateOrderBookBest(orderBook: evedexApi.OrderBookBestUpdateEvent) {
    if ((this.lastOrderBookBestTime.get(orderBook.instrument) ?? 0) >= orderBook.t) {
      return;
    }

    this.lastOrderBookBestTime.set(orderBook.instrument, orderBook.t);
    this.onOrderBookBestUpdate(orderBook);
  }

  private lastOrderBookTime = new Map<string, number>();

  protected updateOrderBook(orderBook: evedexApi.OrderBookUpdateEvent) {
    if ((this.lastOrderBookTime.get(orderBook.instrument) ?? 0) >= orderBook.t) {
      return;
    }

    this.lastOrderBookTime.set(orderBook.instrument, orderBook.t);
    this.onOrderBookUpdate(orderBook);
  }

  private lastTradeDate = new Map<string, Date>();

  protected updateTrade(trade: evedexApi.TradeEvent) {
    if ((this.lastTradeDate.get(trade.instrument) ?? new Date(0)) >= new Date(trade.createdAt)) {
      return;
    }

    this.lastTradeDate.set(trade.instrument, new Date(trade.createdAt));
    this.onTrade(trade);
  }

  // Signals
  public readonly onMatcherState = evedexApi.utils.signal<evedexApi.MatcherUpdateEvent>();

  async listenMatcherState() {
    if (this.lastMatcherStateTime !== undefined) return;

    this.lastMatcherStateTime = new Date();
    this.wsGateway.listenMatcher();

    const matcherState = await this.exchangeGateway.getMarketInfo();
    this.updateMatcherState({ state: matcherState.state, updatedAt: matcherState.updatedAt });
  }

  unListenMatcherState() {
    this.wsGateway.unListenMatcher();
    this.lastMatcherStateTime = undefined;
  }

  public readonly onOrderBookBestUpdate =
    evedexApi.utils.signal<evedexApi.OrderBookBestUpdateEvent>();

  async listenOrderBookBest(instrument: string) {
    if (this.lastOrderBookBestTime.has(instrument)) {
      return;
    }

    this.lastOrderBookBestTime.set(instrument, 0);
    this.wsGateway.listenOrderBookBest({ instrument });

    const orderBook = await this.exchangeGateway.getMarketDepth({
      instrument,
      maxLevel: 1,
      roundPrice: evedexApi.utils.OrderBookRoundPrices.OneTenth,
    });
    this.updateOrderBookBest({
      instrument,
      t: orderBook.t,
      asks: orderBook.asks.length ? [orderBook.asks[0]] : [],
      bids: orderBook.bids.length ? [orderBook.bids[orderBook.bids.length - 1]] : [],
    });
  }

  unListenOrderBookBest(instrument: string) {
    this.wsGateway.unListenOrderBookBest({ instrument });
    this.lastOrderBookBestTime.delete(instrument);
  }

  public readonly onOrderBookUpdate = evedexApi.utils.signal<evedexApi.OrderBookUpdateEvent>();

  async listenOrderBook(instrument: string) {
    if (this.lastOrderBookTime.has(instrument)) {
      return;
    }

    this.lastOrderBookTime.set(instrument, 0);
    this.wsGateway.listenOrderBook({ instrument });

    const orderBook = await this.exchangeGateway.getMarketDepth({
      instrument,
      maxLevel: 30,
      roundPrice: evedexApi.utils.OrderBookRoundPrices.OneTenth,
    });
    this.updateOrderBook({
      instrument,
      ...evedexApi.utils.expandOrderBook(orderBook),
    });
  }

  unListenOrderBook(instrument: string) {
    this.wsGateway.unListenOrderBook({ instrument });
    this.lastOrderBookTime.delete(instrument);
  }

  public readonly onTrade = evedexApi.utils.signal<evedexApi.TradeEvent>();

  async listenTrades(instrument: string) {
    if (this.lastTradeDate.has(instrument)) {
      return;
    }

    this.lastTradeDate.set(instrument, new Date(0));
    this.wsGateway.listenTrades({ instrument });
  }

  unListenTrades(instrument: string) {
    this.wsGateway.unListenTrades({ instrument });
    this.lastTradeDate.delete(instrument);
  }

  // Actions
  skipSession() {
    if (!this.session) return;
    this.httpClient.skipSession();
  }

  async createApiKeyAccount(apiKey: evedexApi.utils.ApiKey) {
    this.httpClient.setSession(apiKey);

    return new ApiKeyAccount({
      gateway: this,
      exchangeAccount: await this.exchangeGateway.me(),
    });
  }

  async createSessionAccount(session: evedexApi.Session) {
    this.httpClient.setSession(session.token);

    return new SessionAccount({
      gateway: this,
      authAccount: session.user,
      exchangeAccount: await this.exchangeGateway.me(),
    });
  }

  async getNonce() {
    const { nonce } = await this.authGateway.getNonce();
    return nonce;
  }

  getSiweMessage(nonce: string, address: string, chainId: string, expirationTime?: string) {
    return new SiweMessage({
      scheme: "https",
      domain: "evedex.com",
      uri: "https://evedex.com",
      address,
      statement: "Sign in to evedex.com",
      nonce,
      expirationTime,
      chainId: Number(chainId),
      version: "1",
    }).prepareMessage();
  }

  async signInSessionAccount(siwe: evedexApi.SignInSiweQuery) {
    const session = await this.authGateway.signInSiwe(siwe);
    return this.createSessionAccount(session);
  }

  async signInWalletAccount(wallet: Wallet) {
    const [nonce, address, chainId] = await Promise.all([
      this.getNonce(),
      wallet.getAddress(),
      wallet.getChainId(),
    ]);

    const message = this.getSiweMessage(nonce, address, chainId);

    const session = await this.authGateway.signInSiwe({
      address,
      message,
      nonce,
      signature: await wallet.signMessage(message),
    });

    this.httpClient.setSession(session.token);

    return new WalletAccount({
      gateway: this,
      wallet,
      authAccount: session.user,
      exchangeAccount: await this.exchangeGateway.me(),
    });
  }
}

export interface ApiKeyAccountOptions {
  gateway: Gateway;
  exchangeAccount: evedexApi.utils.User;
}

export class ApiKeyAccount {
  constructor(private readonly options: Readonly<ApiKeyAccountOptions>) {}

  // Getters
  get gateway() {
    return this.options.gateway;
  }

  get authGateway() {
    return this.gateway.authGateway;
  }

  get exchangeGateway() {
    return this.gateway.exchangeGateway;
  }

  get wsGateway() {
    return this.gateway.wsGateway;
  }

  get exchangeAccount() {
    return this.options.exchangeAccount;
  }

  get session() {
    return this.options.gateway.session;
  }

  getBalance() {
    return new Balance({ account: this });
  }
}

export interface SessionAccountOptions extends ApiKeyAccountOptions {
  authAccount: evedexApi.User;
}

export class SessionAccount extends ApiKeyAccount {
  public readonly authAccount: evedexApi.User;

  constructor(options: Readonly<SessionAccountOptions>) {
    super(options);
    this.authAccount = options.authAccount;
  }
}

export interface WalletAccountOptions extends SessionAccountOptions {
  wallet: Wallet;
}

export class WalletAccount extends SessionAccount {
  public readonly wallet: Wallet;

  constructor(options: Readonly<WalletAccountOptions>) {
    super(options);
    this.wallet = options.wallet;
  }

  // Actions
  signWithdraw(withdraw: evedexCrypto.TradingBalanceWithdraw) {
    return evedexCrypto.signTradingBalanceWithdraw(this.wallet, withdraw);
  }

  async createWithdraw(withdraw: evedexCrypto.TradingBalanceWithdraw) {
    return this.exchangeGateway.withdraw(await this.signWithdraw(withdraw));
  }

  signClosePositionOrder(
    order: Omit<evedexCrypto.utils.PositionCloseOrder, "id"> & { id?: string },
  ) {
    return evedexCrypto.signPositionCloseOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createClosePositionOrder(
    order: Omit<evedexCrypto.utils.PositionCloseOrder, "id"> & { id?: string },
  ) {
    return this.exchangeGateway.closePosition(await this.signClosePositionOrder(order));
  }

  updatePosition(query: evedexApi.PositionUpdateQuery) {
    return this.exchangeGateway.updatePosition(query);
  }

  signLimitOrder(order: Omit<evedexCrypto.utils.LimitOrder, "id"> & { id?: string }) {
    return evedexCrypto.signLimitOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createLimitOrder(order: Omit<evedexCrypto.utils.LimitOrder, "id"> & { id?: string }) {
    return this.exchangeGateway.createLimitOrder(await this.signLimitOrder(order));
  }

  signReplaceLimitOrder(order: evedexCrypto.utils.ReplaceLimitOrder) {
    return evedexCrypto.signReplaceLimitOrder(this.wallet, order);
  }

  async replaceLimitOrder(order: evedexCrypto.utils.ReplaceLimitOrder) {
    return this.exchangeGateway.replaceLimitOrder(await this.signReplaceLimitOrder(order));
  }

  signMarketOrder(order: Omit<evedexCrypto.utils.MarketOrder, "id"> & { id?: string }) {
    return evedexCrypto.signMarketOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createMarketOrder(order: Omit<evedexCrypto.utils.MarketOrder, "id"> & { id?: string }) {
    return this.exchangeGateway.createMarketOrder(await this.signMarketOrder(order));
  }

  signStopLimitOrder(order: Omit<evedexCrypto.utils.StopLimitOrder, "id"> & { id?: string }) {
    return evedexCrypto.signStopLimitOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createStopLimitOrder(
    order: Omit<evedexCrypto.utils.StopLimitOrder, "id"> & { id?: string },
  ) {
    return this.exchangeGateway.createStopLimitOrder(await this.signStopLimitOrder(order));
  }

  signReplaceStopLimitOrder(order: evedexCrypto.utils.ReplaceStopLimitOrder) {
    return evedexCrypto.signReplaceStopLimitOrder(this.wallet, order);
  }

  async replaceStopLimitOrder(order: evedexCrypto.utils.ReplaceStopLimitOrder) {
    return this.exchangeGateway.replaceStopLimitOrder(await this.signReplaceStopLimitOrder(order));
  }

  cancelOrder(query: evedexApi.OrderCancelQuery) {
    return this.exchangeGateway.cancelOrder(query);
  }

  massCancelUserOrders(query: evedexApi.OrderMassCancelQuery) {
    return this.exchangeGateway.massCancelUserOrders(query);
  }

  massCancelUserOrdersById(query: evedexApi.OrderMassCancelByIdQuery) {
    return this.exchangeGateway.massCancelUserOrdersById(query);
  }

  signCreateTpSl(tpsl: evedexCrypto.utils.TpSl) {
    return evedexCrypto.signTpSl(this.wallet, tpsl);
  }

  async createTpSl(tpsl: evedexCrypto.SignedTpSl) {
    return this.exchangeGateway.createTpSl(await this.signCreateTpSl(tpsl));
  }

  updateTpSl(query: evedexApi.TpSlUpdateQuery) {
    return this.exchangeGateway.updateTpSl(query);
  }

  cancelTpSl(query: evedexApi.TpSlCancelQuery) {
    return this.exchangeGateway.cancelTpSl(query);
  }
}

export type AvailableBalance = {
  funding: {
    currency: string;
    balance: string;
  };
  position: evedexApi.utils.AvailableBalance["position"];
  openOrder: evedexApi.utils.AvailableBalance["openOrder"];
  availableBalance: string;
};

export interface Power {
  funding: string;
  anotherPositionVolume: string;
  buy: {
    position: string;
    unFilledOrder: string;
    power: string;
  };
  sell: {
    position: string;
    unFilledOrder: string;
    power: string;
  };
}

export interface BalanceOptions {
  account: ApiKeyAccount;
}

export class Balance {
  private _listening = false;

  constructor(private readonly options: BalanceOptions) {}

  protected updateAccount(account: evedexApi.AccountEvent) {
    if (new Date(this.options.account.exchangeAccount.updatedAt) >= new Date(account.updatedAt)) {
      return;
    }

    this.options.account.exchangeAccount.marginCall = account.marginCall;
    this.options.account.exchangeAccount.updatedAt = account.updatedAt;
    this.onAccountUpdate(this.options.account.exchangeAccount);
  }

  private funding = new Map<string, evedexApi.utils.Funding>();

  protected updateFunding(funding: evedexApi.utils.Funding) {
    const currentState = this.funding.get(funding.coin);
    if (currentState && new Date(currentState.updatedAt) >= new Date(funding.updatedAt)) {
      return;
    }

    const updated = {
      coin: funding.coin,
      quantity: Number(funding.quantity),
      updatedAt: funding.updatedAt,
    };
    this.funding.set(funding.coin, updated);
    this.onFundingUpdate(updated);
  }

  private positions = new Map<string, evedexApi.utils.Position>();

  protected updatePosition(position: evedexApi.utils.Position) {
    const currentState = this.positions.get(position.instrument);
    if (currentState && new Date(currentState.updatedAt) >= new Date(position.updatedAt)) {
      return;
    }

    this.positions.set(position.instrument, position);
    this.onPositionUpdate(position);
  }

  private orders = new Map<string, evedexApi.utils.Order>();

  protected updateOrder(order: evedexApi.utils.Order) {
    const currentState = this.orders.get(order.id);
    if (currentState && new Date(currentState.updatedAt) >= new Date(order.updatedAt)) {
      return;
    }

    this.orders.set(order.id, order);
    this.onOrderUpdate(order);
  }

  private tpsl = new Map<string, evedexApi.utils.TpSl>();

  protected updateTpSl(tpsl: evedexApi.utils.TpSl) {
    const currentState = this.tpsl.get(tpsl.id);
    if (currentState && new Date(currentState.updatedAt) >= new Date(tpsl.updatedAt)) {
      return;
    }

    this.tpsl.set(tpsl.id, tpsl);
    this.onTpSlUpdate(tpsl);
  }

  // Getters
  get account() {
    return this.options.account;
  }

  get gateway() {
    return this.account.gateway;
  }

  get listening() {
    return this._listening;
  }

  getFundingQuantity(currency: CollateralCurrency) {
    return String(this.funding.get(currency)?.quantity ?? 0);
  }

  getPositionList() {
    return Array.from(this.positions.values());
  }

  getPosition(instrument: string) {
    return this.positions.get(instrument);
  }

  getOrderList() {
    return Array.from(this.orders.values());
  }

  getTpSlList() {
    return Array.from(this.tpsl.values());
  }

  getAvailableBalance(): AvailableBalance {
    const funding = {
      currency: CollateralCurrency.USDT,
      balance: this.getFundingQuantity(CollateralCurrency.USDT),
    };
    const position = Array.from(
      this.positions.values(),
      ({ instrument, side, quantity, avgPrice, leverage }) => {
        const volume = Big(quantity).mul(avgPrice);
        return {
          instrument,
          side,
          volume: volume.toString(),
          initialMargin: volume.div(leverage).toString(),
        };
      },
    );
    const openOrderMap = Array.from(
      this.orders.values(),
      ({ instrument, side, unFilledQuantity, limitPrice }) => {
        const unFilledVolume = evedexCrypto.utils.toMatcherNumber(
          Big(unFilledQuantity).mul(limitPrice),
        );
        const position = this.positions.get(instrument);
        return {
          instrument,
          side,
          unFilledVolume: unFilledVolume,
          unFilledInitialMargin: position
            ? Big(unFilledVolume).div(position.leverage).toString()
            : "0",
        };
      },
    ).reduce((carry, { instrument, side, unFilledVolume, unFilledInitialMargin }) => {
      const id = `${instrument}:${side}`;
      const order = carry.get(id) ?? {
        instrument,
        side,
        unFilledVolume: "0",
        unFilledInitialMargin: "0",
      };
      order.unFilledVolume = evedexCrypto.utils.toMatcherNumber(
        Big(order.unFilledVolume).plus(unFilledVolume),
      );
      order.unFilledInitialMargin = evedexCrypto.utils.toMatcherNumber(
        Big(order.unFilledInitialMargin).plus(unFilledInitialMargin),
      );
      carry.set(id, order);

      return carry;
    }, new Map<string, { instrument: string; side: evedexCrypto.utils.Side; unFilledVolume: string; unFilledInitialMargin: string }>());
    const lock = position.reduce((carry, { instrument, side, initialMargin }) => {
      const against =
        side === evedexCrypto.utils.Side.Buy
          ? evedexCrypto.utils.Side.Sell
          : evedexCrypto.utils.Side.Buy;

      return carry.plus(
        Math.max(
          Big(openOrderMap.get(`${instrument}:${side}`)?.unFilledInitialMargin ?? 0)
            .plus(initialMargin)
            .toNumber(),
          Big(openOrderMap.get(`${instrument}:${against}`)?.unFilledInitialMargin ?? 0).toNumber(),
        ),
      );
    }, Big(0));

    return {
      funding: {
        currency: funding.currency,
        balance: funding.balance.toString(),
      },
      position,
      openOrder: Array.from(openOrderMap.values()),
      availableBalance: Big(funding.balance).minus(lock).toString(),
    };
  }

  getPower(instrument: string): Power {
    const position = this.positions.get(instrument);
    const positionInitialMargin = Big(
      position
        ? evedexCrypto.utils.toMatcherNumber(
            Big(position.quantity).mul(position.avgPrice).div(position.leverage),
          )
        : "0",
    );
    const anotherPositionInitialMargin = Array.from(this.positions.values()).reduce(
      (sum, p) =>
        Big(
          p.instrument !== instrument
            ? evedexCrypto.utils.toMatcherNumber(
                Big(p.quantity).plus(p.avgPrice).div(p.leverage).plus(sum),
              )
            : sum,
        ),
      Big(0),
    );

    const orderMap = Array.from(
      this.orders.values(),
      ({ instrument, side, unFilledQuantity, limitPrice }) => {
        const position = this.positions.get(instrument);
        return {
          instrument,
          side,
          unFilledInitialMargin: Big(
            position
              ? evedexCrypto.utils.toMatcherNumber(
                  Big(unFilledQuantity).mul(limitPrice).div(position.leverage),
                )
              : 0,
          ),
        };
      },
    ).reduce(
      (carry, { side, unFilledInitialMargin }) =>
        carry.set(side, (carry.get(side) ?? Big(0)).plus(unFilledInitialMargin)),
      new Map<evedexCrypto.utils.Side, Big.Big>(),
    );

    const funding = Big(this.getFundingQuantity(CollateralCurrency.USDT));
    // Buy
    const buyPosition =
      position && position.side === evedexCrypto.utils.Side.Buy
        ? positionInitialMargin
        : positionInitialMargin.mul(-1);
    const buyUnFilledOrder = orderMap.get(evedexCrypto.utils.Side.Buy) ?? Big(0);
    const buyPower = funding
      .minus(buyPosition)
      .minus(buyUnFilledOrder)
      .minus(anotherPositionInitialMargin);

    // Sell
    const sellPosition =
      position && position.side === evedexCrypto.utils.Side.Sell
        ? positionInitialMargin
        : positionInitialMargin.mul(-1);
    const sellUnFilledOrder = orderMap.get(evedexCrypto.utils.Side.Sell) ?? Big(0);
    const sellPower = funding
      .minus(sellPosition)
      .minus(sellUnFilledOrder)
      .minus(anotherPositionInitialMargin);

    return {
      funding: funding.toString(),
      anotherPositionVolume: anotherPositionInitialMargin.toString(),
      buy: {
        position: buyPosition.toString(),
        unFilledOrder: buyUnFilledOrder.toString(),
        power: evedexCrypto.utils.toMatcherNumber(buyPower),
      },
      sell: {
        position: sellPosition.toString(),
        unFilledOrder: sellUnFilledOrder.toString(),
        power: evedexCrypto.utils.toMatcherNumber(sellPower),
      },
    };
  }

  // Signals
  public readonly onAccountUpdate = evedexApi.utils.signal<evedexApi.utils.User>();

  public readonly onFundingUpdate = evedexApi.utils.signal<evedexApi.utils.Funding>();

  public readonly onPositionUpdate = evedexApi.utils.signal<evedexApi.utils.Position>();

  public readonly onOrderUpdate = evedexApi.utils.signal<evedexApi.utils.Order>();

  public readonly onTpSlUpdate = evedexApi.utils.signal<evedexApi.utils.TpSl>();

  async listen() {
    if (this._listening) return this;

    this._listening = true;
    const listenQuery = { userExchangeId: this.account.exchangeAccount.exchangeId };
    this.gateway.wsGateway.onAccountUpdate((account) => this.updateAccount(account));
    this.gateway.wsGateway.listenAccount(listenQuery);
    this.gateway.wsGateway.onFundingUpdate((funding) =>
      this.updateFunding({ ...funding, quantity: Number(funding.quantity) }),
    );
    this.gateway.wsGateway.listenFunding(listenQuery);
    this.gateway.wsGateway.onPositionUpdate((position) => this.updatePosition(position));
    this.gateway.wsGateway.listenPositions(listenQuery);
    this.gateway.wsGateway.onOrderUpdate((order) => this.updateOrder(order));
    this.gateway.wsGateway.listenOrders(listenQuery);
    this.gateway.wsGateway.onTpSlUpdate((tpsl) => this.updateTpSl(tpsl));
    this.gateway.wsGateway.listenTpSl(listenQuery);

    await Promise.all([
      this.gateway.exchangeGateway.me().then((account) =>
        this.updateAccount({
          ...account,
          user: account.id,
        }),
      ),
      this.gateway.exchangeGateway
        .getFunding()
        .then((list) => list.forEach((data) => this.updateFunding(data))),
      this.gateway.exchangeGateway
        .getPositions()
        .then(({ list }) => list.forEach((data) => this.updatePosition(data))),
      this.gateway.exchangeGateway
        .getOrders({})
        .then(({ list }) => list.forEach((data) => this.updateOrder(data))),
      this.gateway.exchangeGateway
        .getTpSl({})
        .then(({ list }) => list.forEach((data) => this.updateTpSl(data))),
    ]);

    return this;
  }

  async unListen() {
    if (!this._listening) return this;

    const unListenQuery = { userExchangeId: this.account.exchangeAccount.exchangeId };
    this.gateway.wsGateway.unListenAccount(unListenQuery);
    this.gateway.wsGateway.unListenFunding(unListenQuery);
    this.funding.clear();
    this.gateway.wsGateway.unListenPositions(unListenQuery);
    this.positions.clear();
    this.gateway.wsGateway.unListenOrders(unListenQuery);
    this.orders.clear();
    this.gateway.wsGateway.unListenTpSl(unListenQuery);
    this.tpsl.clear();
    this._listening = false;

    return this;
  }
}
