import { buildSiwsMessage, payoutWalletStatement } from "@realms-world/identity";
import { ec, hash, typedData, RpcProvider, RpcError, type TypedData } from "starknet";
import { afterEach, expect, it, vi } from "vitest";
import { verifyWalletOnMainnet } from "./wallet-signature";

const READY = "0x073414441639dcd11d1846f287650a00c60c416b9d3ba45d31c651672125b2c2";
const missing = () => new RpcError({ code: 20, message: "Contract not found" }, "starknet_call", []);
afterEach(() => vi.restoreAllMocks());
const BRAAVOS = "0x03d16c7a9a60b0593bd202f660a28c5d76e0403601d9ccc7e4fa253b6a70c201";
const fixture = (classHash = READY, guarded = false) => {
  const secret = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const key = ec.starkCurve.getStarkKey(secret);
  const guardianSecret = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const guardianKey = ec.starkCurve.getStarkKey(guardianSecret);
  const calldata =
    classHash === BRAAVOS ? [key] : guarded ? ["0x0", key, "0x0", "0x0", guardianKey] : ["0x0", key, "0x1"];
  const deployment = { classHash, salt: key, constructorCalldata: calldata };
  const address = hash.calculateContractAddressFromHash(
    deployment.salt,
    deployment.classHash,
    deployment.constructorCalldata,
    0,
  );
  const message = buildSiwsMessage({
    address,
    chainId: "SN_MAIN",
    domain: "play.realms.party",
    uri: "https://play.realms.party",
    nonce: "account-bound-nonce",
    statement: payoutWalletStatement("0x2"),
  });
  const signature = ec.starkCurve.sign(typedData.getMessageHash(message as TypedData, address), secret);
  const guardianSignature = ec.starkCurve.sign(typedData.getMessageHash(message as TypedData, address), guardianSecret);
  const signatures = guarded
    ? [
        "2",
        "0",
        key,
        String(signature.r),
        String(signature.s),
        "0",
        guardianKey,
        String(guardianSignature.r),
        String(guardianSignature.s),
      ]
    : [String(signature.r), String(signature.s)];
  return { deployment, address, message, signature: signatures };
};
it("verifies an undeployed allow-listed Ready account's actual SIWS signature at its reproduced address", async () => {
  const f = fixture();
  vi.spyOn(RpcProvider.prototype, "callContract").mockRejectedValue(missing());
  vi.spyOn(RpcProvider.prototype, "getClassHashAt").mockRejectedValue(missing());
  await expect(
    verifyWalletOnMainnet("https://rpc.realms.test")(f.message, f.signature, f.address, f.deployment),
  ).resolves.toBe(true);
});

const absent = () => {
  vi.spyOn(RpcProvider.prototype, "callContract").mockRejectedValue(missing());
  vi.spyOn(RpcProvider.prototype, "getClassHashAt").mockRejectedValue(missing());
};
it("requires the constructor's guardian signature as well as the owner signature", async () => {
  absent();
  const f = fixture(READY, true);
  const verify = verifyWalletOnMainnet("https://rpc.realms.test");
  expect(await verify(f.message, f.signature, f.address, f.deployment)).toBe(true);
  expect(await verify(f.message, f.signature.slice(0, 5), f.address, f.deployment)).toBe(false);
});
it("accepts the documented Braavos native Stark signature and refuses hardware/passkey formats", async () => {
  absent();
  const f = fixture(BRAAVOS);
  const verify = verifyWalletOnMainnet("https://rpc.realms.test");
  expect(await verify(f.message, ["1", ...f.signature], f.address, f.deployment)).toBe(true);
  expect(await verify(f.message, ["5", ...f.signature], f.address, f.deployment)).toBe(false);
});
it("rejects address, salt, constructor, class and signed-message substitutions", async () => {
  absent();
  const f = fixture();
  const verify = verifyWalletOnMainnet("https://rpc.realms.test");
  for (const deployment of [
    { ...f.deployment, salt: "0x1" },
    { ...f.deployment, classHash: "0x999" },
    { ...f.deployment, constructorCalldata: ["0x0", "0x1", "0x1"] },
    { ...f.deployment, constructorCalldata: [...f.deployment.constructorCalldata, "0x0"] },
  ])
    expect(await verify(f.message, f.signature, f.address, deployment)).toBe(false);
  expect(await verify(f.message, f.signature, "0x123", f.deployment)).toBe(false);
  expect(
    await verify(
      { ...f.message, message: { ...f.message.message, nonce: "another nonce" } },
      f.signature,
      f.address,
      f.deployment,
    ),
  ).toBe(false);
});
it("never overrides a deployed wallet's rejected signature with its original deployment key", async () => {
  const f = fixture();
  const call = vi.spyOn(RpcProvider.prototype, "callContract").mockResolvedValue(["0x0"]);
  const status = vi.spyOn(RpcProvider.prototype, "getClassHashAt");
  expect(await verifyWalletOnMainnet("https://rpc.realms.test")(f.message, f.signature, f.address, f.deployment)).toBe(
    false,
  );
  expect(call).toHaveBeenCalled();
  expect(status).not.toHaveBeenCalled();
});
it("does not turn a deployed contract failure or an RPC outage into an offchain success", async () => {
  const f = fixture();
  vi.spyOn(RpcProvider.prototype, "callContract").mockRejectedValue(new Error("verification failed"));
  const status = vi.spyOn(RpcProvider.prototype, "getClassHashAt").mockResolvedValue(READY);
  const verify = verifyWalletOnMainnet("https://rpc.realms.test");
  await expect(verify(f.message, f.signature, f.address, f.deployment)).rejects.toThrow();
  status.mockRejectedValue(new Error("RPC unavailable"));
  await expect(verify(f.message, f.signature, f.address, f.deployment)).rejects.toThrow("RPC unavailable");
});
