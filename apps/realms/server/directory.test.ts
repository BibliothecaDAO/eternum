import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { normalizeStarknetAddress } from "@realms-world/identity";
import { afterEach, expect, test, vi } from "vitest";

import { handleDirectory, handleDirectoryHistory, superviseNotifiers } from "./directory";

const shard = { url: "https://first.test", chainId: "0x1" };

const game = (game_id: number, status: HeraldGameDirectoryEntry["status"], end_at = 0) =>
  ({ game_id, status, clock: { end_at }, player_state: { registered: game_id !== 4 } }) as HeraldGameDirectoryEntry;
const games = [game(1, "Live"), game(2, "Registration"), game(3, "Settled", 100), game(4, "Settled", 200)];
const manifestOf = (chainId: string) => ({
  version: 1,
  chainId,
  rpcUrl: "https://rpc.test",
  contracts: { games: "0x7" },
});
/** The manifest as the directory lists it: as its Herald serves it, its chain id in one spelling. */
const listedManifest = (chainId: string) => ({ ...manifestOf(chainId), chainId: normalizeStarknetAddress(chainId) });
/** A shard's Herald: its manifest, and its games directory. */
const herald = (chainId: string, input: RequestInfo | URL, listed = games) =>
  String(input).endsWith("/manifest")
    ? Response.json(manifestOf(chainId))
    : Response.json({ chain: chainId, games: listed });
const gamesReads = (fetchShard: { mock: { calls: Parameters<typeof fetch>[] } }) =>
  fetchShard.mock.calls.map(([url]) => String(url)).filter((url) => !url.endsWith("/manifest"));

const dependencies = (
  readLaunchDirectory: () => Promise<{
    chains: { chainId: string; games: { gameId: number; slotId: number | null }[] }[];
  }>,
) => ({
  db: { prepare: () => ({ first: async () => shard }) } as unknown as D1Database,
  cache: { match: async () => undefined, put: async () => undefined } as unknown as Cache,
  fetchShard: vi.fn<typeof fetch>(async (input) => herald(shard.chainId, input)),
  readLaunchDirectory,
});

afterEach(() => vi.restoreAllMocks());

test("a failed entry read keeps the shard's name visible as unavailable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const deps = dependencies(async () => {
    throw new Error("launch unavailable");
  });
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    shard: { ...shard, manifest: null, games: null, error: "unavailable" },
  });
});

test("an empty directory lists no shard and no history", async () => {
  const deps = {
    ...dependencies(healthyLaunch),
    db: { prepare: () => ({ first: async () => null }) } as unknown as D1Database,
  };
  expect(await (await handleDirectory(new Request("https://app.test/api/directory"), deps)).json()).toEqual({
    shard: null,
  });
  const history = await handleDirectoryHistory(new Request("https://app.test/api/directory/history"), deps);
  expect(await history.json()).toEqual({ games: [], next: null, failures: [] });
  expect(deps.fetchShard).not.toHaveBeenCalled();
});

test("a failed entry read refuses history terms and reports the shard", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const deps = dependencies(async () => {
    throw new Error("launch unavailable");
  });
  const request = (cursor = "") => new Request(`https://app.test/api/directory/history?player=0x123&limit=1${cursor}`);
  const first = await handleDirectoryHistory(request(), deps);
  expect(first.status).toBe(200);
  expect(await first.json()).toEqual({
    games: [],
    next: null,
    failures: [{ url: shard.url, error: "unavailable" }],
  });
  const second = await handleDirectoryHistory(request("&cursor=100:0x2:3"), deps);
  expect(await second.json()).toEqual({
    games: [],
    next: null,
    failures: [{ url: shard.url, error: "unavailable" }],
  });
});

test("only the shard chain's launch records make its games visible", async () => {
  const deps = dependencies(async () => ({
    chains: [
      { chainId: "0x1", games: [1, 4].map((gameId) => ({ gameId, slotId: null })) },
      { chainId: "0x2", games: [{ gameId: 2, slotId: null }] },
    ],
  }));
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(await response.json()).toEqual({
    shard: { ...shard, manifest: listedManifest("0x1"), games: [{ ...games[0], slotId: null }] },
  });
  const history = await handleDirectoryHistory(new Request("https://app.test/api/directory/history"), deps);
  expect(await history.json()).toEqual({
    games: [{ ...games[3], slotId: null, chainId: "0x1", shardUrl: "https://first.test" }],
    next: null,
    failures: [],
  });
});

test("the listed shard has a player notification watcher, and an empty directory starts none", async () => {
  const watch = vi.fn(async () => {});
  const named = vi.fn((name: string) => name);
  const namespace = { idFromName: named, get: () => ({ watch }) } as unknown as Parameters<
    typeof superviseNotifiers
  >[1];
  const listing = (row: typeof shard | null) =>
    ({ prepare: () => ({ first: async () => row }) }) as unknown as D1Database;
  await superviseNotifiers(listing(shard), namespace);
  await superviseNotifiers(listing(null), namespace);
  expect(named.mock.calls).toEqual([[shard.url]]);
  expect(watch.mock.calls).toEqual([[shard]]);
});

test("publishes the launch slot number and no ledger address payload", async () => {
  const deps = dependencies(async () => ({ chains: [{ chainId: "0x1", games: [{ gameId: 1, slotId: 12 }] }] }));
  deps.fetchShard.mockImplementation(async (input) => herald("0x1", input, [games[0]!]));
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  const game = ((await response.json()) as { shard: { games: { slotId: number }[] } }).shard.games[0]!;
  expect(game.slotId).toBe(12);
  expect(game).not.toHaveProperty("entry");
});
test("invalid slot metadata faults the shard", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const slotId of [undefined, -1, 1.5]) {
    const deps = dependencies(async () => ({ chains: [{ chainId: "0x1", games: [{ gameId: 1, slotId }] }] }) as never);
    const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
    expect(((await response.json()) as { shard: { games: unknown; error?: string } }).shard).toMatchObject({
      games: null,
      error: "unavailable",
    });
  }
});

/** A colo cache that keeps what it is given, so a test sees which reads a cached answer saves. */
const memoryCache = () => {
  const entries = new Map<string, Response>();
  return {
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, response: Response) => void entries.set(key.url, response.clone()),
  } as unknown as Cache;
};

type DirectoryBody = { shard: { games: unknown; error?: string } };
const shardOf = async (response: Response) => ((await response.json()) as DirectoryBody).shard;

const healthyLaunch = async () => ({
  chains: [{ chainId: shard.chainId, games: games.map(({ game_id }) => ({ gameId: game_id, slotId: null })) }],
});

test("both routes read the launch records and the shard registry at the same time", async () => {
  for (const route of ["/api/directory", "/api/directory/history"]) {
    let registryRead!: () => void;
    const registryStarted = new Promise<void>((resolve) => (registryRead = resolve));
    const deps = {
      ...dependencies(async () => {
        // Resolves only once the registry read has begun: a route that waited for the launch records first never
        // reaches the registry, and this read never finishes.
        await registryStarted;
        return healthyLaunch();
      }),
      db: {
        prepare: () => ({
          first: async () => {
            registryRead();
            return shard;
          },
        }),
      } as unknown as D1Database,
    };
    const handle = route === "/api/directory" ? handleDirectory : handleDirectoryHistory;
    const answered = handle(new Request(`https://app.test${route}`), deps).then((response) => response.status);
    const stalled = new Promise((resolve) => setTimeout(() => resolve("stalled"), 500));
    expect([route, await Promise.race([answered, stalled])]).toEqual([route, 200]);
  }
});

test("everyone without a player shares one cached listing; a player's listing is always read", async () => {
  const deps = { ...dependencies(vi.fn(healthyLaunch)), cache: memoryCache() };
  const registry = vi.spyOn(deps.db, "prepare");
  const first = await (await handleDirectory(new Request("https://app.test/api/directory"), deps)).json();
  const second = await (await handleDirectory(new Request("https://app.test/api/directory"), deps)).json();
  const history = await handleDirectoryHistory(new Request("https://app.test/api/directory/history"), deps);
  expect(second).toEqual(first);
  const settled = ((await history.json()) as { games: { game_id: number }[] }).games;
  expect(settled.map(({ game_id }) => game_id)).toEqual([4, 3]);
  expect([deps.readLaunchDirectory, registry].map((read) => vi.mocked(read).mock.calls.length)).toEqual([1, 1]);
  expect(gamesReads(deps.fetchShard)).toHaveLength(1);

  await handleDirectory(new Request("https://app.test/api/directory?player=0x123"), deps);
  expect(vi.mocked(deps.readLaunchDirectory).mock.calls.length).toBe(2);
  expect(gamesReads(deps.fetchShard).at(-1)).toBe(`${shard.url}/games?player=0x123`);
});

test("a listing with a failed read is not shared: the next request reads again", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  let launchUp = false;
  const readLaunch = vi.fn(async () => {
    if (!launchUp) throw new Error("launch unavailable");
    return healthyLaunch();
  });
  const deps = { ...dependencies(readLaunch), cache: memoryCache() };
  const failed = await shardOf(await handleDirectory(new Request("https://app.test/api/directory"), deps));
  expect(failed.error).toBe("unavailable");
  launchUp = true;
  const recovered = await shardOf(await handleDirectory(new Request("https://app.test/api/directory"), deps));
  await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(Array.isArray(recovered.games)).toBe(true);
  expect(readLaunch.mock.calls.length).toBe(2);
});

test("a shard whose manifest names another chain is listed as unavailable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const deps = dependencies(async () => ({ chains: [{ chainId: "0x1", games: [{ gameId: 1, slotId: null }] }] }));
  deps.fetchShard.mockImplementation(async (input) =>
    herald(String(input).endsWith("/manifest") ? "0x9" : "0x1", input),
  );
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(await response.json()).toEqual({
    shard: { ...shard, manifest: null, games: null, error: "unavailable" },
  });
});

test("directory history filters by mode before applying limit and rejects unknown modes", async () => {
  const mixed = [
    { ...game(10, "Settled", 300), mode: "blitz" },
    { ...game(11, "Settled", 200), mode: "blitz" },
    { ...game(12, "Settled", 100), mode: "frontier" },
  ] as HeraldGameDirectoryEntry[];
  const deps = dependencies(async () => ({
    chains: [{ chainId: "0x1", games: [10, 11, 12].map((gameId) => ({ gameId, slotId: null })) }],
  }));
  deps.fetchShard.mockImplementation(async (input) => herald("0x1", input, mixed));
  const filtered = await handleDirectoryHistory(
    new Request("https://app.test/api/directory/history?limit=1&mode=frontier"),
    deps,
  );
  expect(filtered.status).toBe(200);
  expect(await filtered.json()).toEqual({
    games: [{ ...mixed[2], slotId: null, chainId: "0x1", shardUrl: "https://first.test" }],
    next: null,
    failures: [],
  });
  const invalid = await handleDirectoryHistory(new Request("https://app.test/api/directory/history?mode=bogus"), deps);
  expect(invalid.status).toBe(400);
});
