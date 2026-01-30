import * as evedexApi from "@evedex/exchange-api";
import { Centrifuge, PublicationContext, Subscription } from "centrifuge";

export class CentrifugeSubscription implements evedexApi.utils.CentrifugeSubscription {
  constructor(
    protected readonly channel: Subscription,
    protected readonly client: CentrifugeClient,
  ) {
    const reasons = ["jwt malformed", "token expired", "unauthorized"];

    channel.on("subscribed", (ctx) => {
      if (ctx.wasRecovering && !ctx.recoverable) {
        this.onRecover(null);
        this.client.onRecover(this);
      }
    });

    channel.on("unsubscribed", (ctx) => {
      if (!reasons.includes(ctx.reason)) return;

      setTimeout(() => {
        this.subscribe();
      }, 5000);
    });

    channel.on("publication", (ctx) => this.onPublication(ctx));
  }

  onPublication = evedexApi.utils.signal<PublicationContext>();

  onRecover = evedexApi.utils.signal<null>();

  subscribe() {
    this.channel.subscribe();
  }

  unsubscribe() {
    this.channel.unsubscribe();
    this.onPublication(evedexApi.utils.SignalSkipAll);
  }
}

export class CentrifugeClient implements evedexApi.utils.CentrifugeClient {
  protected readonly channels = new Map<string, CentrifugeSubscription>();

  constructor(
    protected readonly centrifuge: Centrifuge,
    protected readonly prefix: string,
    private readonly getToken: () => string,
  ) {
    centrifuge.on("connected", () => this.onConnected(null));
    centrifuge.on("disconnected", () => this.onDisconnected(null));
  }

  onConnected = evedexApi.utils.signal<null>();

  onDisconnected = evedexApi.utils.signal<null>();

  onRecover = evedexApi.utils.signal<CentrifugeSubscription>();

  connect() {
    return this.centrifuge.connect();
  }

  disconnect() {
    return this.centrifuge.disconnect();
  }

  assignChannel(name: string, options: Partial<evedexApi.utils.SubscriptionOptions> = {}) {
    let channel = this.channels.get(name);
    if (channel) return channel;

    channel = new CentrifugeSubscription(
      this.centrifuge.newSubscription(`${this.prefix}:${name}`, {
        ...options,
        getData: async () => {
          try {
            const accessToken = this.getToken();

            if (!accessToken) return undefined;

            return {
              accessToken,
            };
          } catch (error) {
            console.error(error);

            return undefined;
          }
        },
      }),
      this,
    );
    this.channels.set(name, channel);

    return channel;
  }
}
