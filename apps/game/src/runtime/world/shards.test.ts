// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

/** A registry like the real one: opening a shard by URL records it under the chain id its manifest declares. */
const registry = vi.hoisted(() => {
  const manifests: Record<string, string> = {
    "https://shard-a.test": "0xa",
    "https://shard-b.test": "0xb",
    "https://pasted.test": "0xc",
  };
  const open = new Map<string, { url: string; chainId: string }>();
  const openShard = vi.fn(async (url: string) => {
    const chainId = manifests[url];
    if (!chainId) throw new Error(`Shard ${url} manifest failed: 503`);
    const shard = { url, chainId };
    open.set(chainId, shard);
    return shard;
  });
  return { manifests, open, openShard };
});

vi.mock("@bibliothecadao/eternum/shard", () => ({
  openShard: registry.openShard,
  getShards: () => [...registry.open.values()],
  requireShard: (chainId: string) => {
    const shard = registry.open.get(chainId);
    if (!shard) throw new Error(`Shard for chain ${chainId} is not open`);
    return shard;
  },
}));
vi.mock("../../../../../contracts/l3/world-native/schema/client.gen", () => ({ nativeFactSchemaIdentity: "schema" }));

/** The registry of known shards lives for a page; each test starts a fresh page. */
const loadShards = async () => {
  vi.resetModules();
  return import("./shards");
};

const directory = {
  shards: [
    { url: "https://shard-a.test", chainId: "0xa", status: "active", games: [] },
    { url: "https://shard-b.test", chainId: "0xb", status: "active", games: null, error: "unavailable" },
    { url: "https://old.test", chainId: "0xd", status: "retired", games: [] },
  ],
};

beforeEach(() => {
  registry.open.clear();
  registry.openShard.mockClear();
  localStorage.clear();
  vi.stubGlobal("fetch", async (input: string) =>
    input === "/api/directory" ? Response.json(directory) : new Response(null, { status: 404 }),
  );
});

it("opens a game's own shard from the route's chain id, taking shard URLs from our directory", async () => {
  const { requireOpenShard } = await loadShards();
  const shard = await requireOpenShard("0xb");
  expect(shard).toEqual({ url: "https://shard-b.test", chainId: "0xb" });
  // Entering a game on shard B opened shard B alone; shard A's Herald was not contacted.
  expect(registry.openShard.mock.calls.map(([url]) => url)).toEqual(["https://shard-b.test"]);
});

it("keeps a pasted shard beside the directory's, and names the directory when it cannot be read", async () => {
  localStorage.setItem("PASTED_SHARD_URLS", JSON.stringify(["https://pasted.test"]));
  const withDirectory = await loadShards();
  await expect(withDirectory.requireOpenShard("0xc")).resolves.toEqual({ url: "https://pasted.test", chainId: "0xc" });

  vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
  registry.open.clear();
  const { openKnownShards, requireOpenShard } = await loadShards();
  const failures = await openKnownShards();
  expect(failures.map((failure) => [failure.url, failure.error.message])).toEqual([
    ["/api/directory", "Directory answered 503"],
  ]);
  await expect(requireOpenShard("0xc")).resolves.toEqual({ url: "https://pasted.test", chainId: "0xc" });
});
