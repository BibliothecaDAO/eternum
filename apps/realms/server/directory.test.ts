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
    chains: { chainId: string; games: { gameId: number; entry: import("@realms-world/identity").GameEntry }[] }[];
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
      { chainId: "0x1", games: [{ gameId: 1, entry: { kind: "free" as const } }] },
      { chainId: "0x2", games: [2, 4].map((gameId) => ({ gameId, entry: { kind: "free" as const } })) },
    ],
  }));
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(await response.json()).toEqual({
    shards: [
      { ...shards[0], games: [{ ...games[0], entry: { kind: "free" } }] },
      { ...shards[1], games: [{ ...games[1], entry: { kind: "free" } }] },
    ],
  });
  const history = await handleDirectoryHistory(new Request("https://app.test/api/directory/history"), deps);
  expect(await history.json()).toEqual({
    games: [{ ...games[3], entry: { kind: "free" }, chainId: "0x2", shardUrl: "https://second.test" }],
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

test("uses the launch record's paid terms, including L2 chain, even when Herald claims free", async () => {
  const paid = {
    kind: "paid" as const,
    ledger: { address: "0x10", chainId: "0x534e5f5345504f4c4941", feeToken: "0x30", shard: "0x1", gameId: 1 },
  };
  const deps = dependencies(async () => ({ chains: [{ chainId: "0x1", games: [{ gameId: 1, entry: paid }] }] }));
  deps.fetchShard.mockResolvedValue(Response.json({ chain: "0x1", games: [{ ...games[0], entry: { kind: "free" } }] }));
  const result = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(((await result.json()) as { shards: { games: { entry: unknown }[] }[] }).shards[0]!.games[0]!.entry).toEqual(
    paid,
  );
});

test("an invalid or missing entry faults the shard instead of becoming a free game", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const entry of [
    undefined,
    { kind: "paid", ledger: { address: "0x10", chainId: "0x1", feeToken: "0x2", shard: "0x9", gameId: 1 } },
  ]) {
    const deps = dependencies(async () => ({ chains: [{ chainId: "0x1", games: [{ gameId: 1, entry }] }] }) as never);
    const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
    expect(((await response.json()) as { shards: { games: unknown; error?: string }[] }).shards[0]).toMatchObject({
      games: null,
      error: "unavailable",
    });
  }
});
