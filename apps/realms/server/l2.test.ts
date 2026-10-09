import { afterEach, expect, it, vi } from "vitest";
import { RpcProvider } from "starknet";
import { identityL2Configuration, identityProvider, verifyIdentityChain, realmOwnerOf, fetchIdentityRpc } from "./l2";
import { decodeIdentityEnv } from "./env";
import { verifyWalletOnL2 } from "./wallet-signature";

const env = {
  L2_CHAIN_ID: "SN_SEPOLIA" as const,
  IDENTITY_RPC_URL: "https://starknet-sepolia.g.alchemy.com/v2/test",
  REALMS_ADDRESS: "0x30",
};
afterEach(() => vi.restoreAllMocks());
it("requires an explicit chain and only its HTTPS Alchemy endpoint without exposing credentials", () => {
  expect(() => identityL2Configuration({ ...env, L2_CHAIN_ID: undefined } as never)).toThrow("L2_CHAIN_ID");
  for (const url of [
    "https://other.test/v2/private",
    "http://starknet-sepolia.g.alchemy.com/v2/private",
    "https://starknet-mainnet.g.alchemy.com/v2/private",
  ])
    expect(() => identityL2Configuration({ ...env, IDENTITY_RPC_URL: url })).toThrow("IDENTITY_RPC_URL");
  expect(identityL2Configuration(env).chainId).toBe("SN_SEPOLIA");
  expect(
    identityL2Configuration({
      ...env,
      IDENTITY_RPC_URL: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_9/test",
    }).chainId,
  ).toBe("SN_SEPOLIA");
});
it("refuses a provider on another chain before any Realm or wallet read", async () => {
  vi.spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f4d41494e");
  const calls = vi.spyOn(RpcProvider.prototype, "callContract");
  const deployments = vi.spyOn(RpcProvider.prototype, "getClassHashAt");
  const { buildSiwsMessage } = await import("@realms-world/identity");
  const message = buildSiwsMessage({
    address: "0x123",
    chainId: "SN_SEPOLIA",
    domain: "play.test",
    uri: "https://play.test",
    nonce: "nonce",
  });
  await expect(verifyWalletOnL2(env)(message, ["0x1", "0x2"], "0x123")).rejects.toThrow("identity_l2_chain_mismatch");
  expect(deployments).not.toHaveBeenCalled();
  await expect(verifyIdentityChain(identityProvider(env), env)).rejects.toThrow("identity_l2_chain_mismatch");
  await expect(realmOwnerOf(env, "7")).rejects.toThrow("identity_l2_chain_mismatch");
  expect(calls).not.toHaveBeenCalled();
});
it("reads Realm ownership on the configured chain with full u256 calldata", async () => {
  vi.spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f5345504f4c4941");
  const calls = vi.spyOn(RpcProvider.prototype, "callContract").mockResolvedValue(["0x123"]);
  expect(await realmOwnerOf(env, String(2n ** 128n + 4n))).toBe("0x123");
  expect(calls).toHaveBeenCalledWith(
    { contractAddress: "0x30", entrypoint: "owner_of", calldata: ["4", "1"] },
    "latest",
  );
});
it("accepts Sepolia SIWS and refuses another proof chain without a signature or deployment read", async () => {
  vi.spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f5345504f4c4941");
  const calls = vi.spyOn(RpcProvider.prototype, "callContract").mockResolvedValue(["0x1"]);
  const { buildSiwsMessage } = await import("@realms-world/identity");
  const message = buildSiwsMessage({
    address: "0x123",
    chainId: "SN_SEPOLIA",
    domain: "play.test",
    uri: "https://play.test",
    nonce: "nonce",
  });
  const verify = verifyWalletOnL2(env);
  expect(await verify(message, ["0x1", "0x2"], "0x123")).toBe(true);
  calls.mockClear();
  await expect(
    verify({ ...message, domain: { ...message.domain, chainId: "SN_MAIN" } }, ["0x1", "0x2"], "0x123"),
  ).rejects.toThrow("identity_proof_chain_mismatch");
  expect(calls).not.toHaveBeenCalled();
});

it("fails Worker environment decoding before serving any route when its chain is absent", () => {
  expect(() => decodeIdentityEnv({ IDENTITY_RPC_URL: env.IDENTITY_RPC_URL })).toThrow("L2_CHAIN_ID");
  try {
    decodeIdentityEnv({ ...env, IDENTITY_RPC_URL: "https://other.test/v2/private" });
    throw new Error("configuration was accepted");
  } catch (error) {
    expect(String(error)).toContain("IDENTITY_RPC_URL");
    expect(String(error)).not.toContain("private");
  }
});

it("refuses RPC redirects using the real Worker-compatible manual mode", async () => {
  const transport = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://other.test" } }));
  await expect(fetchIdentityRpc(env.IDENTITY_RPC_URL, { method: "POST", body: "{}" })).rejects.toThrow(
    "identity_l2_redirect_refused",
  );
  expect(transport).toHaveBeenCalledOnce();
  expect(transport).toHaveBeenCalledWith(env.IDENTITY_RPC_URL, expect.objectContaining({ redirect: "manual" }));
});

it("names missing read targets and never includes private environment values in decode failures", () => {
  const raw = {
    ...env,
    RATING_TOKEN_ADDRESS: "0x31",
    RATING_HISTORY_URL: "https://history.test/population",
    BETTER_AUTH_SECRET: "private-marker",
  };
  expect(() => decodeIdentityEnv({ ...raw, REALMS_ADDRESS: undefined })).toThrow("REALMS_ADDRESS");
  try {
    decodeIdentityEnv(raw);
    throw new Error("configuration was accepted");
  } catch (error) {
    expect(String(error)).toContain("identity_environment_invalid");
    expect(String(error)).not.toContain("private-marker");
    expect(String(error)).not.toContain("/v2/test");
  }
});
