import { config, src, timeout } from "../common";
import WebSocket from "ws";
import { assert } from "chai";
import { MatcherUpdateEvent } from "../../src";

describe("Bot sdk test", () => {
  const sdk = new src.DevContainer({
    centrifugeWebSocket: WebSocket,
    wallets: {
      baseAccount: {
        privateKey: config.privateKey,
        chain: "16182",
      },
    },
  });

  context("Test matcher state listener", () => {
    it("Should subscribe on matcher state changes with gateway singleton", async () => {
      let matcherStateData: MatcherUpdateEvent | null = null;

      sdk.gateway().onMatcherState((matcherState) => {
        assert.isString(matcherState.state);
        assert.isNumber(new Date(matcherState.updatedAt).getTime());
        matcherStateData = matcherState;
      });

      sdk.gateway().listenMatcherState();

      await timeout(2000);

      assert.isNotNull(matcherStateData);
    });
  });
});
