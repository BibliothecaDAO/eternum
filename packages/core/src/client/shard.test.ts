// @vitest-environment node

import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import { openShard, refreshShardRelease, requireShard, ShardReleaseMismatchError } from "./shard";

const schema = { version: 2, encoding: "cairo-serde" };
const schemaHash = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
const manifest = (chainId: string) => ({
  version: 1,
  chainId,
  releaseId: "release-7",
  schemaHash,
  releaseSchemas: { "release-7": schemaHash },
  rpcUrl: "https://rpc.shard.test",
  admissionUrl: "https://admission.shard.test",
  accountClassHash: "0x2",
  contracts: { games: "0x77", bridge: "0x78" },
  guardianPublicKey: "0x9",
});

const serve = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(url.includes("/schemas/") ? { identity: schemaHash, ...schema } : body), {
          status: 200,
        }),
    ),
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
  const shard = await openShard("https://two.shard.test", schemaHash);
  expect(requireShard("0xa")).toBe(shard);
  expect(shard).toMatchObject({ chainId: "0xa", worldAddress: "0x77", rpcUrl: "https://rpc.shard.test" });
  await expect(openShard("https://three.shard.test", schemaHash)).rejects.toThrow("both claim chain 0xa");
});

it("reloads release metadata for a hotfix and refuses an unknown or incompatible game release", async () => {
  const updated = { ...manifest("0x0b"), releaseId: "8", releaseSchemas: { "7": schemaHash, "8": schemaHash } };
  serve(updated);
  await expect(refreshShardRelease("https://hotfix.shard.test", "8", schemaHash)).resolves.toMatchObject({
    releaseId: "8",
  });
  await expect(refreshShardRelease("https://hotfix.shard.test", "9", schemaHash)).rejects.toThrow("release 9");
  serve({ ...updated, releaseSchemas: { "8": "schema-b" } });
  await expect(refreshShardRelease("https://hotfix.shard.test", "8", schemaHash)).rejects.toBeInstanceOf(
    ShardReleaseMismatchError,
  );
});

it("refuses schema bytes that do not match the published decoder identity", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("/schemas/") ? { identity: schemaHash, ...schema, version: 99 } : manifest("0x0c"),
          ),
        ),
    ),
  );
  await expect(openShard("https://changed.shard.test", schemaHash)).rejects.toThrow("UNKNOWN_RELEASE_SCHEMA");
});
