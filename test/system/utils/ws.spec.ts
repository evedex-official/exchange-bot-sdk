import { config, src, waitSignal } from "../../common";
import assert from "assert";
import { Centrifuge } from "centrifuge";
import WebSocket from "ws";

describe("CentrifugeClient", () => {
  const centrifugoClient = new src.utils.CentrifugeClient(
    new Centrifuge(config.centrifugoURI, { websocket: WebSocket }),
    config.centrifugoPrefix,
  );
  centrifugoClient.connect();

  it("should subscribe to centrifugo channel", async () => {
    const channel = centrifugoClient.assignChannel("heartbeat");
    const signalWaiter = waitSignal(channel.onPublication);
    channel.subscribe();

    const { data: heartbeat } = await signalWaiter;
    assert.equal("t" in heartbeat && typeof heartbeat.t === "number", true);
    channel.unsubscribe();
  });
});
