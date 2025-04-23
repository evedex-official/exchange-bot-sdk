import * as evedexCrypto from "@evedex/exchange-crypto";
import * as evedexApi from "@evedex/exchange-api";
import { RestClient } from "./utils/rest";
import { Wallet } from "./utils/wallet";
import { CentrifugeClient, CentrifugeSubscription } from "./utils/ws";
import { Centrifuge } from "centrifuge";
import { SiweMessage } from "siwe";
import {
  AccountEvent,
  ApiKey,
  Coin,
  CollateralCurrency,
  Funding,
  InstrumentList,
  InstrumentMetricsList,
  LimitOrderPayload,
  MarketDepth,
  MarketDepthQuery,
  MarketInfo,
  MarketOrderPayload,
  MatcherUpdateEvent,
  OrderBookBestUpdateEvent,
  OrderBookRoundPrices,
  OrderBookUpdateEvent,
  OrderCancelQuery,
  OrderList,
  OrderListQuery,
  OrderMassCancelByIdQuery,
  OrderMassCancelQuery,
  OrderStatus,
  Position,
  PositionCloseOrderPayload,
  PositionUpdateQuery,
  ReplaceLimitOrder,
  ReplaceStopLimitOrder,
  Session,
  Side,
  SignInSiweQuery,
  StopLimitOrderPayload,
  TpSlCancelQuery,
  TpSlList,
  TpSlListQuery,
  TpSlUpdateQuery,
  Trade,
  TradesQuery,
  TradingBalanceWithdraw,
  User,
  OpenedOrdersList,
  OpenedOrder,
  PositionWithoutMetrics,
  TpSlCreatePayload,
  TpSl,
} from "./types";
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

/** Class gateway . */

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
    this.wsGateway.onRecentTrade((trade) => this.updateTrade(trade));
    this.wsGateway.onFundingRateUpdate((fundingRate) => this.updateFundingRateState(fundingRate));
  }

  get session() {
    return this.httpClient.getSession();
  }

  protected updateFundingRateState(fundingRateState: evedexApi.FundingRateEvent) {
    if (
      (this.lastInstrumentFundingRateTime.get(fundingRateState.instrument) ?? 0) >=
      fundingRateState.createdAt
    ) {
      return;
    }

    this.lastInstrumentFundingRateTime.set(fundingRateState.instrument, fundingRateState.createdAt);

    this.onFundingRateUpdate(fundingRateState);
  }

  private lastMatcherStateTime?: Date;

  protected updateMatcherState(matcherState: MatcherUpdateEvent) {
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

  protected updateOrderBookBest(orderBook: OrderBookBestUpdateEvent) {
    if ((this.lastOrderBookBestTime.get(orderBook.instrument) ?? 0) >= orderBook.t) {
      return;
    }

    this.lastOrderBookBestTime.set(orderBook.instrument, orderBook.t);
    this.onOrderBookBestUpdate(orderBook);
  }

  private lastOrderBookTime = new Map<string, number>();

  protected updateOrderBook(orderBook: OrderBookUpdateEvent) {
    if ((this.lastOrderBookTime.get(orderBook.instrument) ?? 0) >= orderBook.t) {
      return;
    }

    this.lastOrderBookTime.set(orderBook.instrument, orderBook.t);
    this.onOrderBookUpdate(orderBook);
  }

  private lastTradeDate = new Map<string, Date>();

  protected updateTrade(trade: Trade) {
    if ((this.lastTradeDate.get(trade.instrument) ?? new Date(0)) >= new Date(trade.createdAt)) {
      return;
    }

    this.lastTradeDate.set(trade.instrument, new Date(trade.createdAt));
    this.onTrade(trade);
  }

  // Signals

  private lastInstrumentFundingRateTime = new Map<string, number>();

  public readonly onFundingRateUpdate = evedexApi.utils.signal<evedexApi.FundingRateEvent>();

  async listenFundingRateState() {
    if (this.lastInstrumentFundingRateTime.size > 0) return;

    this.wsGateway.listenFundingRate();

    const instruments = await this.fetchInstrumentsWithMetrics();

    instruments.forEach((instrument) => {
      this.updateFundingRateState({
        instrument: instrument.name,
        createdAt: instrument.fundingRateCreatedAt.getTime(),
        fundingRate: String(instrument.fundingRate),
      });
    });
  }

  unListenFundingRateState() {
    this.lastInstrumentFundingRateTime.clear();

    this.wsGateway.unListenFundingRate();
  }

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
      roundPrice: OrderBookRoundPrices.OneTenth,
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
      roundPrice: OrderBookRoundPrices.OneTenth,
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
    this.wsGateway.listenRecentTrades({ instrument });
  }

  unListenTrades(instrument: string) {
    this.wsGateway.unListenRecentTrades({ instrument });
    this.lastTradeDate.delete(instrument);
  }

  // Actions
  skipSession() {
    if (!this.session) return;
    this.httpClient.skipSession();
  }

  async createApiKeyAccount(apiKey: ApiKey) {
    this.httpClient.setSession(apiKey);

    return new ApiKeyAccount({
      gateway: this,
      exchangeAccount: await this.exchangeGateway.me(),
    });
  }

  async createSessionAccount(session: Session) {
    this.httpClient.setSession(session.token);

    return new SessionAccount({
      gateway: this,
      authAccount: session.user,
      exchangeAccount: await this.exchangeGateway.me(),
    });
  }

  private async getNonce() {
    const { nonce } = await this.authGateway.getNonce();
    return nonce;
  }

  private getSiweMessage(nonce: string, address: string, chainId: string, expirationTime?: string) {
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

  async signInSessionAccount(siwe: SignInSiweQuery) {
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

  /**
   * Fetches a list of available trading instruments without metrics
   * @returns {Promise<InstrumentList>}
   */
  async fetchInstruments(): Promise<InstrumentList> {
    return this.exchangeGateway.getInstruments();
  }

  /**
   * Fetches a list of available trading instruments along with their metrics.
   *
   * @returns {Promise<InstrumentMetricsList>}
   */

  async fetchInstrumentsWithMetrics(): Promise<InstrumentMetricsList> {
    return this.exchangeGateway.getInstrumentsMetrics();
  }

  /**
   * Fetches a list of available coins with last prices.
   *
   * @returns {Promise<CoinList>} List of coins.
   */
  async fetchCoins(): Promise<Coin[]> {
    return this.exchangeGateway.getCoins().then(({ list }) => list);
  }

  /**
   * Fetches a list of trades based on the provided instrument.
   *
   * @param {TradesQuery} tradesQuery - The query parameters for fetching trades.
   * @returns {Promise<Trade[]>} A promise that resolves to an array of trades.
   */

  async fetchTrades(tradesQuery: TradesQuery): Promise<Trade[]> {
    return this.exchangeGateway.getRecentTrades(tradesQuery);
  }

  /**
   * Fetches the current state of the matcher and fees info.
   *
   * @returns {Promise<MarketInfo>}
   */
  async fetchMarketInfo(): Promise<MarketInfo> {
    return this.exchangeGateway.getMarketInfo();
  }

  /**
   * Fetches the current state of the order book for the given instrument.
   *
   * @param {MarketDepthQuery} marketDepthQuery
   * @returns {Promise<MarketDepth>} A promise that resolves to the current order book state.
   */
  async fetchMarketDepth(marketDepthQuery: MarketDepthQuery): Promise<MarketDepth> {
    const defaultMarketDepthQuery: Pick<evedexApi.MarketDepthQuery, "roundPrice"> = {
      roundPrice: OrderBookRoundPrices.OneTenth,
    };

    const query = { ...defaultMarketDepthQuery, ...marketDepthQuery } as evedexApi.MarketDepthQuery;

    return this.exchangeGateway.getMarketDepth(query);
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

  /**
   * Fetches a list of Take Profit and Stop Loss (TpSl)
   *
   * @param {TpSlListQuery} query - The query parameters to filter the TpSl orders.
   * @returns {Promise<TpSlList>} - A promise that resolves to a list of TpSl orders.
   */

  fetchTpSlList(query: TpSlListQuery): Promise<TpSlList> {
    return this.exchangeGateway.getTpSl(query);
  }

  /**
   * Fetches current user information.
   * @returns {Promise<User>}
   */
  fetchMe(): Promise<User> {
    return this.exchangeGateway.me();
  }

  /**
   * Fetches a list of current user positions.
   * @returns {Promise<Position[]>}
   */
  async fetchPositions(): Promise<Position[]> {
    return this.exchangeGateway.getPositions().then(({ list }) => list);
  }

  /**
   * Fetches a list of user orders based on the provided query parameters.
   *
   * @param {OrderListQuery} orderListQuery - The query parameters for fetching orders.
   * @returns {Promise<OrderList>} A promise that resolves to a list of orders.
   */

  fetchOrders(orderListQuery: OrderListQuery): Promise<OrderList> {
    return this.exchangeGateway.getOrders(orderListQuery);
  }

  /**
   * Fetches the available balance for the current user.
   *
   * @returns {Promise<AvailableBalance>} A promise that resolves to the available balance data.
   */
  async fetchAvailableBalance(): Promise<AvailableBalance> {
    const {
      funding: { currency, balance },
      position: positions,
      openOrder: openOrders,
      availableBalance,
    } = await this.exchangeGateway.getAvailableBalance();

    return {
      funding: {
        currency,
        balance: String(balance),
      },
      positions,
      openOrders,
      availableBalance: String(availableBalance),
    };
  }

  async fetchOpenOrders(): Promise<OpenedOrdersList> {
    return this.exchangeGateway.getOpenedOrders();
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
  private signWithdraw(withdraw: TradingBalanceWithdraw) {
    return evedexCrypto.signTradingBalanceWithdraw(this.wallet, withdraw);
  }

  async createWithdraw(withdraw: TradingBalanceWithdraw) {
    return this.exchangeGateway.withdraw(await this.signWithdraw(withdraw));
  }

  private signClosePositionOrder(order: PositionCloseOrderPayload) {
    return evedexCrypto.signPositionCloseOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createClosePositionOrder(order: PositionCloseOrderPayload) {
    return this.exchangeGateway.closePosition(await this.signClosePositionOrder(order));
  }

  updatePosition(query: PositionUpdateQuery) {
    return this.exchangeGateway.updatePosition(query);
  }

  private signLimitOrder(order: LimitOrderPayload) {
    return evedexCrypto.signLimitOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createLimitOrder(order: LimitOrderPayload) {
    return this.exchangeGateway.createLimitOrder(await this.signLimitOrder(order));
  }

  private signReplaceLimitOrder(order: ReplaceLimitOrder) {
    return evedexCrypto.signReplaceLimitOrder(this.wallet, order);
  }

  async replaceLimitOrder(order: ReplaceLimitOrder) {
    return this.exchangeGateway.replaceLimitOrder(await this.signReplaceLimitOrder(order));
  }

  private signMarketOrder(order: MarketOrderPayload) {
    return evedexCrypto.signMarketOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createMarketOrder(order: MarketOrderPayload) {
    return this.exchangeGateway.createMarketOrder(await this.signMarketOrder(order));
  }

  private signStopLimitOrder(order: StopLimitOrderPayload) {
    return evedexCrypto.signStopLimitOrder(this.wallet, {
      ...order,
      id: order.id ?? generateShortUuid(),
    });
  }

  async createStopLimitOrder(order: StopLimitOrderPayload) {
    return this.exchangeGateway.createStopLimitOrder(await this.signStopLimitOrder(order));
  }

  private signReplaceStopLimitOrder(order: ReplaceStopLimitOrder) {
    return evedexCrypto.signReplaceStopLimitOrder(this.wallet, order);
  }

  async replaceStopLimitOrder(order: ReplaceStopLimitOrder) {
    return this.exchangeGateway.replaceStopLimitOrder(await this.signReplaceStopLimitOrder(order));
  }

  cancelOrder(query: OrderCancelQuery) {
    return this.exchangeGateway.cancelOrder(query);
  }

  massCancelUserOrders(query: OrderMassCancelQuery) {
    return this.exchangeGateway.massCancelUserOrders(query);
  }

  massCancelUserOrdersById(query: OrderMassCancelByIdQuery) {
    return this.exchangeGateway.massCancelUserOrdersById(query);
  }

  private signCreateTpSl(tpsl: TpSlCreatePayload) {
    return evedexCrypto.signTpSl(this.wallet, tpsl);
  }

  async createTpSl(tpsl: TpSlCreatePayload) {
    return this.exchangeGateway.createTpSl(await this.signCreateTpSl(tpsl));
  }

  updateTpSl(query: TpSlUpdateQuery) {
    return this.exchangeGateway.updateTpSl(query);
  }

  cancelTpSl(query: TpSlCancelQuery) {
    return this.exchangeGateway.cancelTpSl(query);
  }
}

export type AvailableBalance = {
  funding: {
    currency: string;
    balance: string;
  };
  positions: evedexApi.utils.AvailableBalance["position"];
  openOrders: evedexApi.utils.AvailableBalance["openOrder"];
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

  protected updateAccount(account: AccountEvent) {
    if (new Date(this.options.account.exchangeAccount.updatedAt) >= new Date(account.updatedAt)) {
      return;
    }

    this.options.account.exchangeAccount.marginCall = account.marginCall;
    this.options.account.exchangeAccount.updatedAt = account.updatedAt;
    this.onAccountUpdate(this.options.account.exchangeAccount);
  }

  private funding = new Map<string, evedexApi.utils.Funding>();

  protected updateFunding(funding: Funding) {
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

  private positions = new Map<string, PositionWithoutMetrics>();

  protected updatePosition(position: PositionWithoutMetrics) {
    const currentState = this.positions.get(position.instrument);
    if (currentState && new Date(currentState.updatedAt) >= new Date(position.updatedAt)) {
      return;
    }

    this.positions.set(position.instrument, position);
    this.onPositionUpdate(position);
  }

  private orders = new Map<string, OpenedOrder>();

  protected updateOrder(order: OpenedOrder) {
    const currentState = this.orders.get(order.id);

    if (currentState && new Date(currentState.updatedAt) >= new Date(order.updatedAt)) {
      return;
    }

    const orderActive = [OrderStatus.New, OrderStatus.PartiallyFilled].includes(order.status);

    if (orderActive) {
      this.orders.set(order.id, order);
    }

    if (currentState && !orderActive) {
      this.orders.delete(currentState.id);
    }

    this.onOrderUpdate(order);
  }

  private tpsl = new Map<string, TpSl>();

  protected updateTpSl(tpsl: TpSl) {
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
    const positions = Array.from(
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
      ({ instrument, side, unFilledQuantity, limitPrice, status }) => {
        const unFilledVolume = evedexCrypto.utils.toMatcherNumber(
          Big(unFilledQuantity).mul(limitPrice),
        );
        const positionData = this.positions.get(instrument);
        return {
          instrument,
          status,
          side,
          unFilledVolume: unFilledVolume,
          unFilledInitialMargin: positions
            ? Big(unFilledVolume)
                .div(positionData?.leverage ?? 1)
                .toString()
            : "0",
        };
      },
    ).reduce((carry, { instrument, side, unFilledVolume, unFilledInitialMargin, status }) => {
      if ([OrderStatus.New, OrderStatus.PartiallyFilled].includes(status)) {
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
      }

      return carry;
    }, new Map<string, { instrument: string; side: evedexCrypto.utils.Side; unFilledVolume: string; unFilledInitialMargin: string }>());
    const lock = positions.reduce((carry, { instrument, side, initialMargin }) => {
      const against = side === Side.Buy ? Side.Sell : Side.Buy;

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
      positions,
      openOrders: Array.from(openOrderMap.values()).filter(
        ({ unFilledVolume }) => Number(unFilledVolume) > 0,
      ),
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
      ({ instrument: instrumentSymbol, side, unFilledQuantity, limitPrice }) => {
        const positionData = this.positions.get(instrumentSymbol);
        return {
          instrument: instrumentSymbol,
          side,
          unFilledInitialMargin: Big(
            position
              ? evedexCrypto.utils.toMatcherNumber(
                  Big(unFilledQuantity)
                    .mul(limitPrice)
                    .div(positionData?.leverage ?? 1),
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

  public readonly onOrderUpdate = evedexApi.utils.signal<evedexApi.utils.OpenedOrder>();

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
        .getOpenedOrders()
        .then((list) => list.forEach((data) => this.updateOrder(data))),
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
