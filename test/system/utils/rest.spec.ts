import * as evedexApi from "@evedex/exchange-api";
import { config, src } from "../../common";
import assert from "assert";

describe("RestClient", () => {
  it("should send request without session", async () => {
    const client = new src.utils.RestClient({});

    const url = new URL(config.exchangeURI);
    url.pathname = "/api/ping";
    const response = await client.request<{ time: number }>({
      method: "GET",
      url: url.toString(),
      headers: { Accept: "application/json" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.statusText, "OK");
    assert.equal(typeof response.data.time, "number");
  });

  it("should send request with session", async () => {
    const client = new src.utils.RestClient({
      session: { apiKey: config.apiKey },
    });

    const url = new URL(config.exchangeURI);
    url.pathname = "/api/user/me";
    const response = await client.authRequest<{ authId: string }>({
      method: "GET",
      url: url.toString(),
      headers: { Accept: "application/json" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.statusText, "OK");
    assert.equal(response.data.authId, config.userAuthId);
  });

  it("should throw error if session not valid", async () => {
    const client = new src.utils.RestClient({
      session: { apiKey: "invalid api key" },
    });

    const url = new URL(config.exchangeURI);
    url.pathname = "/api/user/me";
    try {
      await client.authRequest<{ authId: string }>({
        method: "GET",
        url: url.toString(),
        headers: { Accept: "application/json" },
      });
    } catch (e) {
      if (e instanceof evedexApi.utils.RequestError && e.response) {
        return assert.equal(e.response?.status, 401);
      }
      throw e;
    }
  });

  it("should use auto-refresh jwt", async () => {
    const client = new src.utils.RestClient({});
    const authGateway = new evedexApi.AuthRestGateway({
      authURI: config.authURI,
      httpClient: client,
    });
    client.setAuthGateway(authGateway);

    const jwt = await authGateway.signInSiwe(config.siwe);
    client.setSession({
      accessToken: "invalid access token",
      refreshToken: jwt.token.refreshToken,
    });

    const account = await authGateway.me();

    assert.equal(account.id, config.userAuthId);
  });

  it("should throw error for invalid refresh token", async () => {
    const client = new src.utils.RestClient({
      session: {
        accessToken: "invalid access token",
        refreshToken: "invalid refresh token",
      },
    });
    const authGateway = new evedexApi.AuthRestGateway({
      authURI: config.authURI,
      httpClient: client,
    });
    client.setAuthGateway(authGateway);

    try {
      await authGateway.me();
    } catch (e) {
      if (e instanceof src.utils.RefreshTokenExpiredError) {
        return assert.equal(e.message, "Refresh token is expired");
      }
      throw e;
    }
  });
});
