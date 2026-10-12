import { beforeEach, expect, it, vi } from "vitest";
import { joinShardOperator } from "./shard-account";
import { relayAccountAddress } from "@realms-world/value-ledger";
import worker from "./worker";

const calls = vi.hoisted(() => ({ shard: vi.fn(), chain: vi.fn(), join: vi.fn() }));
vi.mock("cloudflare:workers", () => ({ DurableObject: class {}, WorkerEntrypoint: class {} }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  readRegisteredShard: calls.shard,
  rpcAt: () => ({ getChainId: calls.chain }),
}));
vi.mock("@bibliothecadao/eternum/realms-account", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum/realms-account")>()),
  joinRealmsAccount: calls.join,
  deviceKeyOf: () => ({ publicKey: "0x2", privateKey: "test-key" }),
}));
const shard = {
  chainId: "0x1",
  url: "https://shard.test",
  rpcUrl: "https://shard.test/rpc",
  status: "active",
  accountClassHash: "0x2",
  guardianPublicKey: "0x9",
};
const target = { chainId: "0x1", heraldUrl: "https://shard.test" };
const env = {
  IDENTITY: { shards: async () => [] },
  IDENTITY_HTTP: { fetch: vi.fn(async () => Response.json({ accountClassHash: "0x2", publicKey: "0x9" })) },
  ENVIRONMENT: "staging",
  L2_RPC_URL: "https://ledger.test",
  LEDGER_OPERATOR_ADDRESS: "0x1",
  LEDGER_OPERATOR_PRIVATE_KEY: "0x2",
  BASE_URL: "https://app.test",
  OPERATOR_TOKEN: "test-token",
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "test-key",
};
beforeEach(() => {
  vi.clearAllMocks();
  calls.shard.mockResolvedValue(shard);
  calls.chain.mockResolvedValue("0x1");
  calls.join.mockResolvedValue({ address: relayAccountAddress(shard) });
  env.IDENTITY_HTTP.fetch.mockImplementation(async () => Response.json({ accountClassHash: "0x2", publicKey: "0x9" }));
});
it("enrolls only the relay bot device under the environment guardian, and returns the same holder on retry", async () => {
  const expected = relayAccountAddress(shard);
  expect(await joinShardOperator(env, target.chainId)).toEqual(expected);
  expect(calls.join.mock.calls[0]![0].device).toEqual({ publicKey: "0x2", privateKey: "test-key" });
  const approve = calls.join.mock.calls[0]![0].approve;
  env.IDENTITY_HTTP.fetch.mockResolvedValueOnce(Response.json({ signature: ["0x3", "0x4"] }));
  expect(await approve({ chainId: "0x1", deviceKey: "0x2" })).toEqual(["0x3", "0x4"]);
  expect(env.IDENTITY_HTTP.fetch).toHaveBeenLastCalledWith(
    new URL("https://app.test/api/devices/bots"),
    expect.objectContaining({ redirect: "error", method: "POST" }),
  );
  expect(await joinShardOperator(env, target.chainId)).toEqual(expected);
});
it("refuses unlisted or retired shards before joining", async () => {
  calls.shard.mockRejectedValueOnce(new Error("unlisted_shard"));
  await expect(joinShardOperator(env, target.chainId)).rejects.toThrow("unlisted_shard");
  calls.shard.mockResolvedValueOnce({ ...shard, status: "retired" });
  await expect(joinShardOperator(env, target.chainId)).rejects.toThrow("relay_shard_inactive");
  expect(calls.join).not.toHaveBeenCalled();
});
it("has no deployment enrolment route", async () => {
  expect(
    (
      await worker.fetch(
        new Request("https://app.test/api/value/operator/shard/enrol", {
          method: "POST",
          headers: { authorization: "Bearer test-token" },
        }),
        env as never,
      )
    ).status,
  ).toBe(404);
});
