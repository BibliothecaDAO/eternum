import { buildSiwsMessage, IdentityRequestError } from "@realms-world/identity";
import { RpcError, type AccountInterface, type ProviderInterface } from "starknet";
import { expect, it, vi } from "vitest";
import { walletProofForAccount } from "./wallet-proof";

const missing = () => new RpcError({ code: 20, message: "Contract not found" }, "starknet_call", []);
const fixture = () => {
  const native = vi.fn(async () => ["0x1", "0x2"]);
  const standard = vi.fn(async () => ["0x3", "0x4"]);
  const request = vi.fn(async () => ({ class_hash: "0x123", salt: "0x1", calldata: ["0x2"] }));
  const account = {
    address: "0x123",
    signMessage: standard,
    walletProvider: { request, account: { signMessage: native } },
  } as unknown as AccountInterface;
  const status = vi.fn(async () => "0x456");
  const provider = { getClassHashAt: status } as unknown as ProviderInterface;
  return { account, provider, native, standard, request, status };
};
const message = buildSiwsMessage({
  address: "0x123",
  chainId: "SN_MAIN",
  domain: "localhost",
  uri: "https://localhost",
  nonce: "nonce",
});
it("keeps deployed wallet verification/signing on its ordinary account without deployment reads from the wallet", async () => {
  const f = fixture();
  const proof = await walletProofForAccount(f.account, f.provider, "controller");
  await proof.signTypedData(message);
  expect(f.standard).toHaveBeenCalledWith(message);
  expect(f.native).not.toHaveBeenCalled();
  expect(f.request).not.toHaveBeenCalled();
  expect(proof.deployment).toBeUndefined();
});
it("asks Ready for deployment data and signs SIWS with its documented skipDeploy option", async () => {
  const f = fixture();
  f.status.mockRejectedValue(missing());
  const proof = await walletProofForAccount(f.account, f.provider, "argentX");
  expect(proof.deployment).toEqual({ classHash: "0x123", salt: "0x1", constructorCalldata: ["0x2"] });
  await proof.signTypedData(message);
  expect(f.request).toHaveBeenCalledWith({ type: "wallet_deploymentData" });
  expect(f.native).toHaveBeenCalledWith(message, { skipDeploy: true });
  expect(f.standard).not.toHaveBeenCalled();
});
it("uses Braavos' normal typed-message signer with its deployment data", async () => {
  const f = fixture();
  f.status.mockRejectedValue(missing());
  const proof = await walletProofForAccount(f.account, f.provider, "braavos");
  await proof.signTypedData(message);
  expect(f.standard).toHaveBeenCalledWith(message);
  expect(f.native).not.toHaveBeenCalled();
});
it("reports unsupported Controller deployment data and never invents an owner key", async () => {
  const f = fixture();
  f.status.mockRejectedValue(missing());
  f.request.mockRejectedValue({ code: 63 });
  await expect(walletProofForAccount(f.account, f.provider, "controller")).rejects.toBeInstanceOf(IdentityRequestError);
  expect(f.standard).not.toHaveBeenCalled();
});
it("does not guess absence when the mainnet RPC is unavailable", async () => {
  const f = fixture();
  f.status.mockRejectedValue(new Error("RPC unavailable"));
  await expect(walletProofForAccount(f.account, f.provider, "argentX")).rejects.toThrow("RPC unavailable");
  expect(f.request).not.toHaveBeenCalled();
});

it("reads Ready's documented camel-case payload without guessing omitted salt or constructor order", async () => {
  const f = fixture();
  f.status.mockRejectedValue(missing());
  f.request.mockResolvedValue({ classHash: "0x123", addressSalt: "0x1", constructorCalldata: ["0x2"] } as never);
  expect((await walletProofForAccount(f.account, f.provider, "argentX")).deployment).toEqual({
    classHash: "0x123",
    salt: "0x1",
    constructorCalldata: ["0x2"],
  });
  f.request.mockResolvedValue({ classHash: "0x123", constructorCalldata: ["0x2"] } as never);
  await expect(walletProofForAccount(f.account, f.provider, "argentX")).rejects.toBeInstanceOf(IdentityRequestError);
});
