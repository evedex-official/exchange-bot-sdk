import { config, src, timeout } from "../common";
import WebSocket from "ws";
import { assert } from "chai";
import { InstrumentMetrics, MatcherUpdateEvent, Side } from "../../src";

describe("Bot sdk test", () => {
  const sdk = new src.DevContainer({
    centrifugeWebSocket: WebSocket,
    wallets: {
      baseAccount: config.privateKey,
    },
  });

  let instrumentSettings: InstrumentMetrics | null = null;

  context("Test matcher state listener", () => {
    it("Should subscribe on matcher state changes with gateway singleton", async () => {
      let matcherStateData: MatcherUpdateEvent | null = null;

      sdk.gateway().onMatcherState((matcherState) => {
        assert.isString(matcherState.state);
        assert.isNumber(new Date(matcherState.updatedAt).getTime());
        matcherStateData = matcherState;
      });

      sdk.gateway().listenMatcherState();

      await timeout(3000);

      assert.isNotNull(matcherStateData);
    });
  });

  context("Test instruments funding rate listener", () => {
    it("Should get instrument list with metrics", async () => {
      const instruments = await sdk.gateway().fetchInstruments();
      assert.isArray(instruments);
      assert.isNotEmpty(instruments);

      instrumentSettings = instruments.find(
        (instrument) => instrument.name === "DBTCUSDT",
      ) as InstrumentMetrics;
    });

    it("Should listen to funding rate updates", async () => {
      sdk.gateway().onFundingRateUpdate((fundingRate) => {
        assert.isString(fundingRate.instrument);
        assert.isNumber(new Date(fundingRate.createdAt).getTime());
        assert.isNumber(Number(fundingRate.fundingRate));
      });

      sdk.gateway().listenFundingRateState();

      await timeout(2000);
    });
  });

  context("Test wallet", () => {
    it("Should return wallet address", async () => {
      assert.equal(
        await sdk.wallet("baseAccount").getAddress(),
        "0xAB750c44e08053Ac7E711b64860D65F75bAbE36B",
      );
    });
  });

  context("Test create order", () => {
    it("Should return validating error", async () => {
      const account = await sdk.account("baseAccount");
      try {
        await account.createLimitOrder({
          instrument: "BTCUSDT",
          limitPrice: 10000,
          quantity: -1,
          side: Side.Buy,
          leverage: 1,
        });
      } catch (error: any) {
        assert.equal(error.message, 'Field "quantity" incorrect uint type');
      }
    });

    it("Should return invalid price error", async () => {
      const account = await sdk.account("baseAccount");
      try {
        await account.createLimitOrder({
          instrument: "DBTCUSDT",
          limitPrice: 1000000,
          quantity: 0.001,
          side: Side.Buy,
          leverage: 1,
        });
      } catch (error: any) {
        assert.equal(error.message, "Invalid price");
      }
    });
  });
});
