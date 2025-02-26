import * as evedexCrypto from "@eventhorizon/exchange-crypto";
import { ethers } from "ethers";

export class UnDetermineChainIdError extends Error {}

export interface WalletOptions {
  privateKey: string;
  chain: ethers.Provider | string;
}

export class Wallet implements evedexCrypto.utils.WalletClient {
  private signer: ethers.Wallet;

  constructor(private readonly options: WalletOptions) {
    this.signer = new ethers.Wallet(
      options.privateKey,
      typeof options.chain !== "string" ? options.chain : undefined,
    );
  }

  getChainId() {
    if (typeof this.options.chain === "string") {
      return this.options.chain;
    }
    if (!this.signer.provider) {
      throw new UnDetermineChainIdError();
    }

    return this.signer.provider.getNetwork().then((network) => String(network.chainId));
  }

  getAddress() {
    return this.signer.getAddress();
  }

  solidityPackedKeccak256(types: string[], values: any[]) {
    return ethers.solidityPackedKeccak256(types, values);
  }

  getBytes(value: string) {
    return ethers.getBytes(value);
  }

  serializeSignature(signature: string) {
    return ethers.Signature.from(signature).serialized;
  }

  signMessage(message: string | Uint8Array) {
    return this.signer.signMessage(message);
  }

  signTypedData(
    domain: any,
    types: Record<string, evedexCrypto.utils.TypedDataField[]>,
    value: Record<string, any>,
  ) {
    return this.signer.signTypedData(domain, types, value);
  }
}
