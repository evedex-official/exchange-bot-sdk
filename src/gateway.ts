import * as evedexCrypto from "@eventhorizon/exchange-crypto";
import * as evedexApi from "@eventhorizon/exchange-api";
import { RestClient } from "./utils/rest";
import { Wallet } from "./utils/wallet";
import { CentrifugeClient, CentrifugeSubscription } from "./utils/ws";
import { Centrifuge } from "centrifuge";
import { CollateralCurrency } from "./utils/types";
import WebSocket from "ws";
import Big from "big.js";

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
            new Centrifuge(options.centrifuge.uri, { websocket: WebSocket }),
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
      roundPrice: evedexApi.OrderBookRoundPrices.OneTenth,
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
      roundPrice: evedexApi.OrderBookRoundPrices.OneTenth,
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

  // Actions
  async signIn(wallet: Wallet, message: string) {
    const session = await this.authGateway.signInSiwe({
      address: await wallet.getAddress(),
      message,
      signature: await wallet.signMessage(message),
    });
    this.httpClient.setSession(session.token);

    return new Account({
      gateway: this,
      wallet,
      authAccount: session.user,
      exchangeAccount: await this.exchangeGateway.me(),
    });
  }
}

export interface AccountOptions {
  gateway: Gateway;
  wallet: Wallet;
  authAccount: evedexApi.User;
  exchangeAccount: evedexApi.utils.User;
}

export class Account {
  constructor(private readonly options: Readonly<AccountOptions>) {}

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

  get authAccount() {
    return this.options.authAccount;
  }

  get exchangeAccount() {
    return this.options.exchangeAccount;
  }

  get session() {
    return this.options.gateway.session;
  }

  get wallet() {
    return this.options.wallet;
  }

  getBalance() {
    return new Balance({ account: this });
  }

  // Actions
  signWithdraw(withdraw: evedexCrypto.TradingBalanceWithdraw) {
    return evedexCrypto.signTradingBalanceWithdraw(this.wallet, withdraw);
  }

  async createWithdraw(withdraw: evedexCrypto.TradingBalanceWithdraw) {
    return this.exchangeGateway.withdraw(await this.signWithdraw(withdraw));
  }

  signClosePositionOrder(order: evedexCrypto.utils.PositionCloseOrder) {
    return evedexCrypto.signPositionCloseOrder(this.wallet, order);
  }

  async createClosePositionOrder(order: evedexCrypto.utils.PositionCloseOrder) {
    return this.exchangeGateway.closePosition(await this.signClosePositionOrder(order));
  }

  updatePosition(query: evedexApi.PositionUpdateQuery) {
    return this.exchangeGateway.updatePosition(query);
  }

  signLimitOrder(order: evedexCrypto.utils.LimitOrder) {
    return evedexCrypto.signLimitOrder(this.wallet, order);
  }

  async createLimitOrder(order: evedexCrypto.utils.LimitOrder) {
    return this.exchangeGateway.createLimitOrder(await this.signLimitOrder(order));
  }

  signReplaceLimitOrder(order: evedexCrypto.utils.ReplaceLimitOrder) {
    return evedexCrypto.signReplaceLimitOrder(this.wallet, order);
  }

  async replaceLimitOrder(order: evedexCrypto.utils.ReplaceLimitOrder) {
    return this.exchangeGateway.replaceLimitOrder(await this.signReplaceLimitOrder(order));
  }

  signMarketOrder(order: evedexCrypto.utils.MarketOrder) {
    return evedexCrypto.signMarketOrder(this.wallet, order);
  }

  async createMarketOrder(order: evedexCrypto.utils.MarketOrder) {
    return this.exchangeGateway.createMarketOrder(await this.signMarketOrder(order));
  }

  signStopLimitOrder(order: evedexCrypto.utils.StopLimitOrder) {
    return evedexCrypto.signStopLimitOrder(this.wallet, order);
  }

  async createStopLimitOrder(order: evedexCrypto.utils.StopLimitOrder) {
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
  account: Account;
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

  getFunding(currency: CollateralCurrency) {
    return String(this.funding.get(currency)?.quantity ?? 0);
  }

  getPosition(instrument: string) {
    return this.positions.get(instrument);
  }

  getAvailableBalance(): AvailableBalance {
    const funding = {
      currency: CollateralCurrency.USDT,
      balance: this.getFunding(CollateralCurrency.USDT),
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

    const funding = Big(this.getFunding(CollateralCurrency.USDT));
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

    await Promise.all([
      this.gateway.exchangeGateway.me().then((account) =>
        this.updateAccount({
          ...account,
          user: account.id,
        }),
      ),
      this.gateway.exchangeGateway.getFunding().then((list) => list.forEach(this.updateFunding)),
      this.gateway.exchangeGateway
        .getPositions()
        .then(({ list }) => list.forEach(this.updatePosition)),
      this.gateway.exchangeGateway.getOrders({}).then(({ list }) => list.forEach(this.updateOrder)),
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
    this._listening = false;

    return this;
  }
}
