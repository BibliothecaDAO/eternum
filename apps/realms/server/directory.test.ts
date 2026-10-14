import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { afterEach, expect, test, vi } from "vitest";

import { handleDirectory, handleDirectoryHistory, superviseNotifiers } from "./directory";

const shards = [
  { url: "https://first.test", chainId: "0x1", status: "active" },
  { url: "https://second.test", chainId: "0x2", status: "draining" },
];

const game = (game_id: number, status: HeraldGameDirectoryEntry["status"], end_at = 0) =>
  ({ game_id, status, clock: { end_at }, player_state: { registered: game_id !== 4 } }) as HeraldGameDirectoryEntry;
const games = [game(1, "Live"), game(2, "Registration"), game(3, "Settled", 100), game(4, "Settled", 200)];

const dependencies = (
  readLaunchDirectory: () => Promise<{
    chains: { chainId: string; games: { gameId: number; slotId: number | null }[] }[];
  }>,
) => ({
  db: { prepare: () => ({ all: async () => ({ results: shards }) }) } as unknown as D1Database,
  cache: { match: async () => undefined, put: async () => undefined } as unknown as Cache,
  fetchShard: vi.fn<typeof fetch>(async (input) => {
    const shard = shards.find(({ url }) => String(input).startsWith(url))!;
    return Response.json({ chain: shard.chainId, games });
  }),
  readLaunchDirectory,
});

afterEach(() => vi.restoreAllMocks());

test("a failed entry read keeps both shard names visible as unavailable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const deps = dependencies(async () => {
    throw new Error("launch unavailable");
  });
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    shards: shards.map((shard) => ({
      ...shard,
      games: null,
      error: "unavailable",
    })),
  });
});

test("a failed entry read refuses history terms and reports the affected shards", async () => {
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
    failures: shards.map(({ url }) => ({ url, error: "unavailable" })),
  });
  const second = await handleDirectoryHistory(request("&cursor=100:0x2:3"), deps);
  expect(await second.json()).toEqual({
    games: [],
    next: null,
    failures: shards.map(({ url }) => ({ url, error: "unavailable" })),
  });
});

test("healthy launch records filter games independently on both chains", async () => {
  const deps = dependencies(async () => ({
    chains: [
      { chainId: "0x1", games: [{ gameId: 1, slotId: null }] },
      { chainId: "0x2", games: [2, 4].map((gameId) => ({ gameId, slotId: null })) },
    ],
  }));
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(await response.json()).toEqual({
    shards: [
      { ...shards[0], games: [{ ...games[0], slotId: null }] },
      { ...shards[1], games: [{ ...games[1], slotId: null }] },
    ],
  });
  const history = await handleDirectoryHistory(new Request("https://app.test/api/directory/history"), deps);
  expect(await history.json()).toEqual({
    games: [{ ...games[3], slotId: null, chainId: "0x2", shardUrl: "https://second.test" }],
    next: null,
    failures: [],
  });
});

test("pending and retired shards have no player notification watcher", async () => {
  const watch = vi.fn(async () => {});
  const stop = vi.fn(async () => {});
  const db = {
    prepare: () => ({
      all: async () => ({
        results: [
          { ...shards[0], status: "pending" },
          { ...shards[1], status: "retired" },
          { url: "https://active.test", chainId: "0x3", status: "active" },
        ],
      }),
    }),
  } as unknown as D1Database;
  const namespace = { idFromName: (name: string) => name, get: () => ({ watch, stop }) } as unknown as Parameters<
    typeof superviseNotifiers
  >[1];
  await superviseNotifiers(db, namespace);
  expect(stop).toHaveBeenCalledTimes(2);
  expect(watch).toHaveBeenCalledOnce();
  expect(watch).toHaveBeenCalledWith({ url: "https://active.test", chainId: "0x3" });
});

test("publishes the launch slot number and no ledger address payload", async () => {
  const deps = dependencies(async () => ({ chains: [{ chainId: "0x1", games: [{ gameId: 1, slotId: 12 }] }] }));
  deps.fetchShard.mockResolvedValue(Response.json({ chain: "0x1", games: [games[0]] }));
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  const game = ((await response.json()) as { shards: { games: { slotId: number }[] }[] }).shards[0]!.games[0]!;
  expect(game.slotId).toBe(12);
  expect(game).not.toHaveProperty("entry");
});
test("invalid slot metadata faults the shard", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const slotId of [undefined, -1, 1.5]) {
    const deps = dependencies(async () => ({ chains: [{ chainId: "0x1", games: [{ gameId: 1, slotId }] }] }) as never);
    const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
    expect(((await response.json()) as { shards: { games: unknown; error?: string }[] }).shards[0]).toMatchObject({
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

type DirectoryBody = { shards: { games: unknown; error?: string }[] };
const shardsOf = async (response: Response) => ((await response.json()) as DirectoryBody).shards;

const healthyLaunch = async () => ({
  chains: shards.map(({ chainId }) => ({
    chainId,
    games: games.map(({ game_id }) => ({ gameId: game_id, slotId: null })),
  })),
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
          all: async () => {
            registryRead();
            return { results: shards };
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
  expect(settled.map(({ game_id }) => game_id)).toEqual([4, 4, 3, 3]);
  expect(
    [deps.readLaunchDirectory, registry, deps.fetchShard].map((read) => vi.mocked(read).mock.calls.length),
  ).toEqual([1, 1, shards.length]);

  await handleDirectory(new Request("https://app.test/api/directory?player=0x123"), deps);
  expect(vi.mocked(deps.readLaunchDirectory).mock.calls.length).toBe(2);
  expect(
    vi
      .mocked(deps.fetchShard)
      .mock.calls.slice(-shards.length)
      .map(([url]) => String(url)),
  ).toEqual(shards.map(({ url }) => `${url}/games?player=0x123`));
});

test("a listing with a failed read is not shared: the next request reads again", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  let launchUp = false;
  const readLaunch = vi.fn(async () => {
    if (!launchUp) throw new Error("launch unavailable");
    return healthyLaunch();
  });
  const deps = { ...dependencies(readLaunch), cache: memoryCache() };
  const failed = await shardsOf(await handleDirectory(new Request("https://app.test/api/directory"), deps));
  expect(failed.every((shard) => shard.error === "unavailable")).toBe(true);
  launchUp = true;
  const recovered = await shardsOf(await handleDirectory(new Request("https://app.test/api/directory"), deps));
  await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(recovered.every((shard) => Array.isArray(shard.games))).toBe(true);
  expect(readLaunch.mock.calls.length).toBe(2);
});
