// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { openShard, refreshShardRelease, requireShard, ShardReleaseMismatchError } from "./shard";

const schemaHash = "compiled-schema";
const manifest = (chainId: string) => ({
  version: 1,
  chainId,
  releaseSchemas: { "7": schemaHash },
  rpcUrl: "https://rpc.shard.test",
  admissionUrl: "https://admission.shard.test",
  accountClassHash: "0x2",
  contracts: { games: "0x77", bridge: "0x78" },
  guardianPublicKey: "0x9",
});
const serve = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body))),
  );
afterEach(() => vi.unstubAllGlobals());

it("refuses a shard with no release this client can read", async () => {
  serve(manifest("0x1"));
  await expect(openShard("https://one.shard.test", "schema-b")).rejects.toBeInstanceOf(ShardReleaseMismatchError);
});
it("reads one manifest, without downloading a schema, and keys the shard by its chain", async () => {
  serve(manifest("0x0a"));
  const shard = await openShard("https://two.shard.test", schemaHash);
  expect(requireShard("0xa")).toBe(shard);
  expect(shard).toMatchObject({ chainId: "0xa", worldAddress: "0x77" });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith("https://two.shard.test/manifest", expect.any(Object));
  await expect(openShard("https://three.shard.test", schemaHash)).rejects.toThrow("both claim chain 0xa");
});
it("resolves the game's release and leaves the shared shard registry unchanged on refresh", async () => {
  serve(manifest("0x0b"));
  const opened = await openShard("https://hotfix.shard.test", schemaHash);
  serve({ ...manifest("0x0b"), releaseSchemas: { "7": schemaHash, "8": schemaHash, "9": "new-schema" } });
  const refreshed = await refreshShardRelease(opened.url, "8", schemaHash);
  expect(refreshed.releaseSchemas["8"]).toBe(schemaHash);
  expect(requireShard("0xb")).toBe(opened);
  expect(opened.releaseSchemas).toEqual({ "7": schemaHash });
  await expect(refreshShardRelease(opened.url, "7", schemaHash)).resolves.toBeDefined();
  await expect(refreshShardRelease(opened.url, "9", schemaHash)).rejects.toThrow("release 9");
  await expect(refreshShardRelease(opened.url, "10", schemaHash)).rejects.toThrow("release 10");
});
