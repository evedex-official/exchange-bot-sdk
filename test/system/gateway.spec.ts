import { config, src, waitSignal } from "../common";
import assert from "assert";
import { Centrifuge } from "centrifuge";
import WebSocket from "ws";

describe("Gateway", () => {
  const gateway = new src.Gateway({
    exchangeURI: config.exchangeURI,
    authURI: config.authURI,
    centrifuge: {
      uri: config.centrifugoURI,
      prefix: config.centrifugoPrefix,
      websocket: WebSocket,
    },
  });

  it("should subscribe on matcher state changes", async () => {
    const signalWaiter = waitSignal(gateway.onMatcherState);
    await gateway.listenMatcherState();

    const matcherState = await signalWaiter;

    assert.equal(typeof matcherState.state, "string");
    assert.equal(typeof matcherState.updatedAt, "string");
  });

  it("should subscribe on order book best changes", async () => {
    const signalWaiter = waitSignal(gateway.onOrderBookBestUpdate);
    await gateway.listenOrderBookBest("DBTCUSDT");

    const orderBookBest = await signalWaiter;

    assert.equal(orderBookBest.instrument, "DBTCUSDT");
    assert.equal(typeof orderBookBest.t, "number");
  });

  it("should subscribe on order book changes", async () => {
    const signalWaiter = waitSignal(gateway.onOrderBookUpdate);
    await gateway.listenOrderBook("DBTCUSDT");

    const orderBook = await signalWaiter;

    assert.equal(orderBook.instrument, "DBTCUSDT");
    assert.equal(typeof orderBook.t, "number");
  });
});
