import * as evedexApi from "@eventhorizon/exchange-api";
import axios, { isAxiosError } from "axios";

export class UnauthorizedRequest extends Error {}

export class RefreshTokenExpiredError extends evedexApi.utils.RequestError {
  constructor(response: evedexApi.utils.Response<any>) {
    super("Refresh token is expired", response);
  }
}

export interface RestClientOptions {
  session?: evedexApi.utils.JWT | evedexApi.utils.RefreshedJWT;
  authGateway?: evedexApi.AuthRestGateway;
}

export class RestClient implements evedexApi.utils.HttpClient {
  private jwt?: evedexApi.utils.JWT | evedexApi.utils.RefreshedJWT;

  constructor(private readonly options: RestClientOptions) {
    this.jwt = options.session;
  }

  setAuthGateway(authGateway: evedexApi.AuthRestGateway) {
    this.options.authGateway = authGateway;
  }

  setSession(jwt: evedexApi.utils.JWT | evedexApi.utils.RefreshedJWT) {
    this.jwt = jwt;
  }

  getSession(): evedexApi.utils.JWT | evedexApi.utils.RefreshedJWT | undefined {
    return this.jwt;
  }

  async request<Data>(request: evedexApi.utils.Request): Promise<evedexApi.utils.Response<Data>> {
    try {
      const res = await axios.request({
        url: request.url,
        method: request.method,
        headers: request.headers,
        data: request.body,
      });

      return {
        status: res.status,
        statusText: res.statusText,
        data: res.data,
      };
    } catch (e) {
      if (isAxiosError(e) && e.response) {
        throw new evedexApi.utils.RequestError(e.response.statusText, {
          status: e.response.status,
          statusText: e.response.statusText,
          data: e.response.data,
        });
      }

      throw e;
    }
  }

  async authRequest<Data>(
    request: evedexApi.utils.Request,
  ): Promise<evedexApi.utils.Response<Data>> {
    if (!this.jwt || !this.jwt.accessToken) {
      throw new UnauthorizedRequest();
    }

    try {
      return await this.request({
        ...request,
        headers: {
          ...request.headers,
          Authorization: `Bearer ${this.jwt.accessToken}`,
        },
      });
    } catch (e) {
      if (
        e instanceof evedexApi.utils.RequestError &&
        e.response?.status === 401 &&
        this.options.authGateway
      ) {
        if (this.options.authGateway && "refreshToken" in this.jwt) {
          try {
            const { token } = await this.options.authGateway.refresh(this.jwt); // todo: use queue
            this.setSession(token);
            return await this.authRequest(request);
          } catch (e2) {
            if (e2 instanceof evedexApi.utils.RequestError && e2.response?.status === 401) {
              throw new RefreshTokenExpiredError(e2.response);
            }
            throw e2;
          }
        }
      }
      throw e;
    }
  }
}
