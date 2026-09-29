import { buildSiwsMessage } from "@realms-world/identity";
import { RpcError, RpcProvider } from "starknet";
import { afterEach, expect, it, vi } from "vitest";

import { verifyWalletOnMainnet, WalletNotDeployedError } from "./wallet-signature";

const message = buildSiwsMessage({
  address: "0x123",
  chainId: "SN_MAIN",
  domain: "play.realms.party",
  nonce: "nonce",
  uri: "https://play.realms.party",
});
const verify = () => verifyWalletOnMainnet("https://rpc.realms.test")(message, ["0x1", "0x2"], "0x123");
const missingWallet = () => new RpcError({ code: 20, message: "Contract not found" }, "starknet_call", []);

afterEach(() => vi.restoreAllMocks());

it("recognizes an undeployed wallet after the SDK wraps the signature call error", async () => {
  vi.spyOn(RpcProvider.prototype, "callContract").mockRejectedValue(missingWallet());
  const deployment = vi.spyOn(RpcProvider.prototype, "getClassHashAt").mockRejectedValue(missingWallet());
  await expect(verify()).rejects.toBeInstanceOf(WalletNotDeployedError);
  expect(deployment).toHaveBeenCalledWith("0x123");
});

it("does not label an RPC outage or a deployed wallet's failure as an undeployed wallet", async () => {
  vi.spyOn(RpcProvider.prototype, "callContract").mockRejectedValue(new Error("RPC unavailable"));
  const deployment = vi.spyOn(RpcProvider.prototype, "getClassHashAt").mockResolvedValue("0x456");
  await expect(verify()).rejects.toThrow("Signature verification Error");
  deployment.mockRejectedValue(new Error("RPC unavailable"));
  await expect(verify()).rejects.toThrow("RPC unavailable");
});

it("does not add a deployment read when signature verification succeeds or rejects the signature", async () => {
  const call = vi.spyOn(RpcProvider.prototype, "callContract").mockResolvedValue(["0x1"]);
  const deployment = vi.spyOn(RpcProvider.prototype, "getClassHashAt");
  await expect(verify()).resolves.toBe(true);
  call.mockResolvedValue(["0x0"]);
  await expect(verify()).resolves.toBe(false);
  expect(deployment).not.toHaveBeenCalled();
});
