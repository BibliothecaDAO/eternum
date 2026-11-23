// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { releaseLine } from "../test-support/releases";

const freshPage = async () => {
  vi.resetModules();
  return import("./shard");
};

const schemaHash = "compiled-schema";
const manifest = (chainId: string) => ({
  version: 1,
  chainId,
  releases: releaseLine(schemaHash, [7]),
  rpcUrl: "https://rpc.shard.test",
  l2GasBound: "0x47868c00",
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
  const { openShard, ShardReleaseMismatchError } = await freshPage();
  serve(manifest("0x1"));
  await expect(openShard("https://one.shard.test", "schema-b")).rejects.toBeInstanceOf(ShardReleaseMismatchError);
});
it("reads one manifest, without downloading a schema, and holds the shard it opened", async () => {
  const { openShard, requireShard } = await freshPage();
  serve(manifest("0x0a"));
  const shard = await openShard("https://two.shard.test", schemaHash);
  expect(requireShard()).toBe(shard);
  expect(shard).toMatchObject({ chainId: "0xa", worldAddress: "0x77" });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith("https://two.shard.test/manifest", expect.any(Object));
});
it("keeps one shard open: it opens again, and another chain or another URL for its chain is refused", async () => {
  const { openShard, getShard } = await freshPage();
  serve(manifest("0x0a"));
  await openShard("https://two.shard.test", schemaHash);
  const again = await openShard("https://two.shard.test", schemaHash);
  expect(getShard()).toBe(again);
  await expect(openShard("https://three.shard.test", schemaHash)).rejects.toThrow("cannot open beside it");
  serve(manifest("0x0b"));
  await expect(openShard("https://two.shard.test", schemaHash)).rejects.toThrow("cannot open beside it");
  expect(getShard()).toBe(again);
});
it("opens a shard from the manifest its listing carries, without asking the shard again", async () => {
  const { openShard, requireShard } = await freshPage();
  serve(manifest("0x0b"));
  const shard = await openShard("https://four.shard.test", schemaHash, undefined, manifest("0x1d"));
  expect(fetch).not.toHaveBeenCalled();
  expect(shard).toMatchObject({ url: "https://four.shard.test", chainId: "0x1d", worldAddress: "0x77" });
  expect(requireShard()).toBe(shard);
});
it("resolves the game's release and leaves the shared shard registry unchanged on refresh", async () => {
  const { openShard, refreshShardRelease, requireShard } = await freshPage();
  serve(manifest("0x0b"));
  const opened = await openShard("https://hotfix.shard.test", schemaHash);
  serve({
    ...manifest("0x0b"),
    releases: { ...releaseLine(schemaHash, [7, 8]), "9": { schema: "new-schema", family: 1, previous: 8 } },
  });
  const refreshed = await refreshShardRelease(opened.url, "8", schemaHash);
  expect(refreshed.releases["8"]?.schema).toBe(schemaHash);
  expect(requireShard()).toBe(opened);
  expect(opened.releases).toEqual(releaseLine(schemaHash, [7]));
  await expect(refreshShardRelease(opened.url, "7", schemaHash)).resolves.toBeDefined();
  await expect(refreshShardRelease(opened.url, "9", schemaHash)).rejects.toThrow("release 9");
  await expect(refreshShardRelease(opened.url, "10", schemaHash)).rejects.toThrow("release 10");
});

it("refuses a manifest without the play gas bound every invoke must carry", async () => {
  const { openShard } = await freshPage();
  const { l2GasBound: _bound, ...unbounded } = manifest("0xd");
  serve(unbounded);
  await expect(openShard("https://unbounded.shard.test", schemaHash)).rejects.toThrow("no valid l2GasBound");
  serve({ ...manifest("0xd"), l2GasBound: "0x0" });
  await expect(openShard("https://unbounded.shard.test", schemaHash)).rejects.toThrow("no valid l2GasBound");
  serve(manifest("0xd"));
  await expect(openShard("https://bounded.shard.test", schemaHash)).resolves.toMatchObject({ l2GasBound: 0x47868c00n });
});

it("validates shard authority before inserting a manifest into the registry", async () => {
  const { openShard, requireShard } = await freshPage();
  serve(manifest("0xc"));
  await expect(
    openShard("https://untrusted.test", schemaHash, () => {
      throw new Error("reserved chain");
    }),
  ).rejects.toThrow("reserved chain");
  expect(() => requireShard()).toThrow("No shard is open");
  await expect(openShard("https://trusted.test", schemaHash)).resolves.toMatchObject({ chainId: "0xc" });
});

it("refuses a shard whose Herald serves release schemas without their families", async () => {
  const { openShard } = await freshPage();
  const { releases: _, ...old } = manifest("0x1");
  serve({ ...old, releaseSchemas: { "7": schemaHash } });
  await expect(openShard("https://old.shard.test", schemaHash)).rejects.toThrow("manifest names no releases");
});
