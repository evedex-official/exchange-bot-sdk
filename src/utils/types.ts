import * as evedexApi from "@eventhorizon/exchange-api";

export enum CollateralCurrency {
  USDT = "usdt",
}

export const OrderBookRoundPrices = evedexApi.utils.OrderBookRoundPrices;
export type OrderBookRoundPricesType = typeof evedexApi.utils.OrderBookRoundPrices;
