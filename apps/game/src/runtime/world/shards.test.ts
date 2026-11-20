import { beforeEach, expect, it, vi } from "vitest";

/** A registry like the real one: opening a shard by URL records it under the chain id its manifest declares. */
const registry = vi.hoisted(() => {
  const manifests: Record<string, string> = {
    "https://shard-a.test": "0xa",
    "https://shard-b.test": "0xb",
    "https://evil.test": "0x0a",
  };
  const open = new Map<string, { url: string; chainId: string }>();
  const openShard = vi.fn(
    async (
      url: string,
      _schema: string,
      validate?: (shard: { url: string; chainId: string }) => void,
      _listedManifest?: unknown,
    ) => {
      const chainId = manifests[url];
      if (!chainId) throw new Error(`Shard ${url} manifest failed: 503`);
      const shard = { url, chainId };
      validate?.(shard);
      open.set(chainId, shard);
      return shard;
    },
  );
  return { manifests, open, openShard };
});

vi.mock("@bibliothecadao/eternum/shard", () => ({
  openShard: registry.openShard,
  getShard: () => registry.open.values().next().value ?? null,
}));
vi.mock("../../../../../contracts/l3/world-native/schema/client.gen", () => ({ nativeFactSchemaIdentity: "schema" }));

/** The registry of known shards lives for a page; each test starts a fresh page. */
const loadShards = async () => {
  vi.resetModules();
  return import("./shards");
};

/** The manifest our directory carries for shard A, as the Worker read it from that shard. */
const manifestA = { version: 1, chainId: "0xa", contracts: { games: "0x1" } };

let directory: { shard: unknown } = { shard: null };
const listing = (shard: unknown) => {
  directory = { shard };
};

beforeEach(() => {
  registry.open.clear();
  registry.openShard.mockClear();
  listing({ url: "https://shard-a.test", chainId: "0xa", games: [], manifest: manifestA });
  vi.stubGlobal("fetch", async (input: string) =>
    input === "/api/directory" ? Response.json(directory) : new Response(null, { status: 404 }),
  );
});

it("opens the directory's one shard from the manifest it carries, and refuses any other chain", async () => {
  const { requireOpenShard } = await loadShards();
  expect(await requireOpenShard("0xa")).toEqual({ url: "https://shard-a.test", chainId: "0xa" });
  expect(await requireOpenShard("0x0a")).toEqual({ url: "https://shard-a.test", chainId: "0xa" });
  expect(registry.openShard.mock.calls.map(([url, , , manifest]) => [url, manifest])).toEqual([
    ["https://shard-a.test", manifestA],
  ]);
  await expect(requireOpenShard("0xb")).rejects.toThrow("Chain 0xb is not the chain our directory lists");
});

it("asks the shard itself when the directory could not read it", async () => {
  listing({ url: "https://shard-b.test", chainId: "0xb", games: null, manifest: null, error: "unavailable" });
  const { openDirectoryShard } = await loadShards();
  expect(await openDirectoryShard()).toEqual({ url: "https://shard-b.test", chainId: "0xb" });
  expect(registry.openShard.mock.calls.map(([url, , , manifest]) => [url, manifest])).toEqual([
    ["https://shard-b.test", undefined],
  ]);
});

it("opens no shard while the directory lists none or cannot be read", async () => {
  listing(null);
  expect(await (await loadShards()).openDirectoryShard()).toBeNull();
  vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
  const { openDirectoryShard, requireOpenShard } = await loadShards();
  await expect(openDirectoryShard()).rejects.toThrow("Directory answered 503");
  await expect(requireOpenShard("0xa")).rejects.toThrow("Directory answered 503");
  expect(registry.open.size).toBe(0);
});

it("refuses a listed shard whose manifest names another chain before registration", async () => {
  listing({ url: "https://evil.test", chainId: "0xe", games: [] });
  const shards = await loadShards();
  await expect(shards.requireOpenShard("0xe")).rejects.toThrow("does not serve its listed chain 0xe");
  await expect(shards.openDirectoryShard()).rejects.toThrow("does not serve its listed chain 0xe");
  expect(registry.open.size).toBe(0);
});
