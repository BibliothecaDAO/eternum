// @vitest-environment node

import { afterEach, expect, it, vi } from "vitest";

import { openShard, requireShard, ShardReleaseMismatchError } from "./shard";

const manifest = (chainId: string) => ({
  version: 1,
  chainId,
  releaseId: "release-7",
  schemaHash: "schema-a",
  rpcUrl: "https://rpc.shard.test",
  admissionUrl: "https://admission.shard.test",
  accountClassHash: "0x2",
  contracts: { season: "0x77", bridge: "0x78" },
});

const serve = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );

afterEach(() => vi.unstubAllGlobals());

it("refuses a shard whose facts this client was not compiled to read, naming its release", async () => {
  serve(manifest("0x1"));
  const opened = openShard("https://one.shard.test", "schema-b");
  await expect(opened).rejects.toBeInstanceOf(ShardReleaseMismatchError);
  await expect(openShard("https://one.shard.test", "schema-b")).rejects.toThrow("release-7");
});

it("addresses each shard by its chain id and refuses a second shard claiming the same chain", async () => {
  serve(manifest("0x0a"));
  const shard = await openShard("https://two.shard.test", "schema-a");
  expect(requireShard("0xa")).toBe(shard);
  expect(shard).toMatchObject({ chainId: "0xa", worldAddress: "0x77", rpcUrl: "https://rpc.shard.test" });
  await expect(openShard("https://three.shard.test", "schema-a")).rejects.toThrow("both claim chain 0xa");
});
