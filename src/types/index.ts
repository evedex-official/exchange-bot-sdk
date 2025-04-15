/* eslint-disable @typescript-eslint/no-redeclare */
import * as evedexApi from "@eventhorizon/exchange-api";
import * as exchangeCrypto from "@eventhorizon/exchange-crypto";

export enum CollateralCurrency {
  USDT = "usdt",
}

export const OrderBookRoundPrices = evedexApi.utils.OrderBookRoundPrices;
export type OrderBookRoundPrices = evedexApi.utils.OrderBookRoundPrices;

export type LimitOrder = exchangeCrypto.utils.LimitOrder;
export type MarketOrder = exchangeCrypto.utils.MarketOrder;
export type StopLimitOrder = exchangeCrypto.utils.StopLimitOrder;
export type PositionCloseOrder = exchangeCrypto.utils.PositionCloseOrder;
export type ReplaceLimitOrder = exchangeCrypto.utils.ReplaceLimitOrder;
export type ReplaceStopLimitOrder = exchangeCrypto.utils.ReplaceStopLimitOrder;
export type TpSl = exchangeCrypto.utils.TpSl;
export type OrderTpSl = exchangeCrypto.utils.OrderTpSl;
export const OrderStatus = evedexApi.utils.OrderStatus;
export type OrderStatus = evedexApi.utils.OrderStatus;
export const OrderType = evedexApi.utils.OrderType;
export type OrderType = evedexApi.utils.OrderType;
export const OrderGroup = evedexApi.utils.OrderGroup;
export type OrderGroup = evedexApi.utils.OrderGroup;
export const TpSlStatus = evedexApi.utils.TpSlStatus;
export type TpSlStatus = evedexApi.utils.TpSlStatus;
export type SignedTpSl = exchangeCrypto.SignedTpSl;
export type TradingBalanceWithdraw = exchangeCrypto.TradingBalanceWithdraw;

export const Side = exchangeCrypto.utils.Side;
export type Side = exchangeCrypto.utils.Side;

export const TimeInForce = exchangeCrypto.utils.TimeInForce;
export type TimeInForce = exchangeCrypto.utils.TimeInForce;

export type PositionUpdateQuery = evedexApi.PositionUpdateQuery;
export type OrderCancelQuery = evedexApi.OrderCancelQuery;
export type OrderMassCancelQuery = evedexApi.OrderMassCancelQuery;
export type OrderMassCancelByIdQuery = evedexApi.OrderMassCancelByIdQuery;
export type TpSlCancelQuery = evedexApi.TpSlCancelQuery;
export type TpSlUpdateQuery = evedexApi.TpSlUpdateQuery;
export type ApiKey = evedexApi.utils.ApiKey;
export type TradeEvent = evedexApi.TradeEvent;
export type OrderBookUpdateEvent = evedexApi.OrderBookUpdateEvent;
export type OrderBookBestUpdateEvent = evedexApi.OrderBookBestUpdateEvent;
export type AccountEvent = evedexApi.AccountEvent;
export type Funding = evedexApi.utils.Funding;
export type Position = evedexApi.utils.Position;
export type Order = evedexApi.utils.Order;
export type MatcherUpdateEvent = evedexApi.MatcherUpdateEvent;
export type Session = evedexApi.Session;
export type SignInSiweQuery = evedexApi.SignInSiweQuery;
export type TpSlState = evedexApi.utils.TpSl;
export type InstrumentMetricsList = evedexApi.utils.InstrumentMetricsList;
export type InstrumentMetrics = evedexApi.utils.InstrumentMetrics;
export type InstrumentList = evedexApi.utils.InstrumentList;
export type CoinList = evedexApi.utils.CoinList;
export type Coin = evedexApi.utils.Coin;
export type TradesQuery = evedexApi.TradesQuery;
export type Trade = evedexApi.utils.Trade;
export type MarketInfo = evedexApi.utils.MarketInfo;
export type OpenedOrdersList = evedexApi.utils.OpenedOrdersList;
export type OpenedOrder = evedexApi.utils.OpenedOrder;
export type PositionMetrics = evedexApi.utils.PositionMetrics;
export interface MarketDepthQuery extends Omit<evedexApi.MarketDepthQuery, "roundPrice"> {
  roundPrice?: OrderBookRoundPrices;
}
export type MarketDepth = evedexApi.utils.MarketDepth;
export type User = evedexApi.utils.User;
export type PositionList = evedexApi.utils.PositionList;
export type OrderListQuery = evedexApi.OrderListQuery;
export type OrderList = evedexApi.utils.OrderList;
export type TpSlListQuery = evedexApi.TpSlListQuery;
export type TpSlList = evedexApi.utils.TpSlList;
export type TpSlUpdateEvent = evedexApi.utils.TpSl;
export type Signal<T> = evedexApi.utils.Signal<T>;
export type AvailableBalanceData = evedexApi.utils.AvailableBalance;
export type OrderPayload<T extends { id: string }> = Omit<T, "id"> & { id?: string };

export type PositionCloseOrderPayload = OrderPayload<PositionCloseOrder>;
export type LimitOrderPayload = OrderPayload<LimitOrder>;
export type MarketOrderPayload = OrderPayload<MarketOrder>;
export type StopLimitOrderPayload = OrderPayload<StopLimitOrder>;
