import { ethers } from "ethers";
import { config, src } from "../../common";
import assert from "assert";

describe("Wallet", () => {
  it("should return chainId from config", async () => {
    const wallet = new src.utils.Wallet({
      privateKey: config.privateKey,
      chain: "1",
    });
    assert.equal(await wallet.getChainId(), "1");
  });

  it("should return chainId from provider", async () => {
    const wallet = new src.utils.Wallet({
      privateKey: config.privateKey,
      chain: new ethers.JsonRpcProvider(config.ethNode),
    });
    assert.equal(await wallet.getChainId(), "16182");
  });

  it("should return wallet address", async () => {
    const wallet = new src.utils.Wallet({
      privateKey: config.privateKey,
      chain: new ethers.JsonRpcProvider(config.ethNode),
    });
    assert.equal(await wallet.getAddress(), "0xAB750c44e08053Ac7E711b64860D65F75bAbE36B");
  });
});
