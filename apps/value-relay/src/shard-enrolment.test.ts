import { beforeEach, expect, it, vi } from "vitest";
import { enrolShardOperator, shardOperatorAddress } from "./shard-enrolment";
import worker from "./worker";

const calls = vi.hoisted(() => ({ shard: vi.fn(), chain: vi.fn(), join: vi.fn() }));
vi.mock("cloudflare:workers", () => ({ DurableObject: class {}, WorkerEntrypoint: class {} }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  readRegisteredShard: calls.shard,
  rpcAt: () => ({ getChainId: calls.chain }),
}));
vi.mock("@bibliothecadao/eternum/realms-account", () => ({
  joinRealmsAccount: calls.join,
  deviceKeyOf: () => ({ publicKey: "0x2", privateKey: "test-key" }),
}));
const shard = {
  chainId: "0x1",
  url: "https://shard.test",
  rpcUrl: "https://shard.test/rpc",
  status: "pending",
  accountClassHash: "0x2",
  guardianPublicKey: "0x9",
};
const target = { chainId: "0x1", heraldUrl: "https://shard.test" };
const env = {
  IDENTITY: { shards: async () => [] },
  IDENTITY_HTTP: { fetch: vi.fn(async () => Response.json({ accountClassHash: "0x2", publicKey: "0x9" })) },
  BASE_URL: "https://app.test",
  OPERATOR_TOKEN: "test-token",
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "test-key",
};
beforeEach(() => {
  vi.clearAllMocks();
  calls.shard.mockResolvedValue(shard);
  calls.chain.mockResolvedValue("0x1");
  calls.join.mockResolvedValue({ address: shardOperatorAddress(shard) });
  env.IDENTITY_HTTP.fetch.mockImplementation(async () => Response.json({ accountClassHash: "0x2", publicKey: "0x9" }));
});
it("enrolls only the relay bot device under the environment guardian, and returns the same holder on retry", async () => {
  const expected = { chainId: "0x1", ledgerOperatorAccount: shardOperatorAddress(shard) };
  expect(await enrolShardOperator(env, target)).toEqual(expected);
  expect(calls.join.mock.calls[0]![0].device).toEqual({ publicKey: "0x2", privateKey: "test-key" });
  const approve = calls.join.mock.calls[0]![0].approve;
  env.IDENTITY_HTTP.fetch.mockResolvedValueOnce(Response.json({ signature: ["0x3", "0x4"] }));
  expect(await approve({ chainId: "0x1", deviceKey: "0x2" })).toEqual(["0x3", "0x4"]);
  expect(env.IDENTITY_HTTP.fetch).toHaveBeenLastCalledWith(
    new URL("https://app.test/api/devices/bots"),
    expect.objectContaining({ redirect: "error", method: "POST" }),
  );
  expect(await enrolShardOperator(env, target)).toEqual(expected);
});
it("refuses an unlisted, retired, retargeted, wrong-chain or wrong-guardian shard before requesting enrollment", async () => {
  calls.shard.mockRejectedValueOnce(new Error("unlisted_shard"));
  await expect(enrolShardOperator(env, target)).rejects.toThrow("unlisted_shard");
  calls.shard.mockResolvedValueOnce({ ...shard, status: "retired" });
  await expect(enrolShardOperator(env, target)).rejects.toThrow("relay_target_differs");
  await expect(enrolShardOperator(env, { ...target, heraldUrl: "https://other.test" })).rejects.toThrow(
    "relay_target_differs",
  );
  calls.chain.mockResolvedValueOnce("0x3");
  await expect(enrolShardOperator(env, target)).rejects.toThrow("relay_chain_differs");
  env.IDENTITY_HTTP.fetch.mockResolvedValueOnce(Response.json({ accountClassHash: "0x2", publicKey: "0x8" }));
  await expect(enrolShardOperator(env, target)).rejects.toThrow("relay_identity_differs");
  expect(calls.join).not.toHaveBeenCalled();
});
it("accepts only operator-authenticated target fields and delegates to the chain's signer", async () => {
  const enrol = vi.fn(async () => ({ ...target, ledgerOperatorAccount: "0x123" }));
  const bindings = { ...env, RELAY: { idFromName: () => "chain", get: () => ({ enrol }) } } as never;
  const request = (body: unknown, token = "test-token") =>
    new Request("https://app.test/api/value/operator/shard/enrol", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect((await worker.fetch(request(target, "wrong"), bindings)).status).toBe(401);
  expect((await worker.fetch(request({ ...target, privateKey: "foreign" }), bindings)).status).toBe(400);
  expect((await worker.fetch(request(target), bindings)).status).toBe(200);
  expect(enrol).toHaveBeenCalledExactlyOnceWith(target);
});
