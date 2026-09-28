import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { afterEach, expect, test, vi } from "vitest";

import { handleDirectory, handleDirectoryHistory } from "./directory";

const shards = [
  { url: "https://first.test", chainId: "0x1", status: "active" },
  { url: "https://second.test", chainId: "0x2", status: "draining" },
];

const game = (game_id: number, status: HeraldGameDirectoryEntry["status"], end_at = 0) =>
  ({ game_id, status, clock: { end_at }, player_state: { registered: game_id !== 4 } }) as HeraldGameDirectoryEntry;
const games = [game(1, "Live"), game(2, "Registration"), game(3, "Settled", 100), game(4, "Settled", 200)];

const dependencies = (readLaunchDirectory: () => Promise<{ chains: { chainId: string; gameIds: number[] }[] }>) => ({
  db: { prepare: () => ({ all: async () => ({ results: shards }) }) } as unknown as D1Database,
  cache: { match: async () => undefined, put: async () => undefined } as unknown as Cache,
  fetchShard: vi.fn<typeof fetch>(async (input) => {
    const shard = shards.find(({ url }) => String(input).startsWith(url))!;
    return Response.json({ chain: shard.chainId, games });
  }),
  readLaunchDirectory,
});

afterEach(() => vi.restoreAllMocks());

test("a failed launch read keeps both shards' games visible as unavailable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const deps = dependencies(async () => {
    throw new Error("launch unavailable");
  });
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    shards: shards.map((shard) => ({
      ...shard,
      games: games.slice(0, 2).map((game) => ({ ...game, error: "unavailable" })),
    })),
  });
});

test("a failed launch read preserves settled history, pagination and player filtering", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const deps = dependencies(async () => {
    throw new Error("launch unavailable");
  });
  const request = (cursor = "") => new Request(`https://app.test/api/directory/history?player=0x123&limit=1${cursor}`);
  const first = await handleDirectoryHistory(request(), deps);
  expect(first.status).toBe(200);
  expect(await first.json()).toEqual({
    games: [{ ...games[2], chainId: "0x2", shardUrl: "https://second.test", error: "unavailable" }],
    next: "100:0x2:3",
    failures: [],
  });
  const second = await handleDirectoryHistory(request("&cursor=100:0x2:3"), deps);
  expect(await second.json()).toEqual({
    games: [{ ...games[2], chainId: "0x1", shardUrl: "https://first.test", error: "unavailable" }],
    next: null,
    failures: [],
  });
});

test("healthy launch records filter games independently on both chains", async () => {
  const deps = dependencies(async () => ({
    chains: [
      { chainId: "0x1", gameIds: [1] },
      { chainId: "0x2", gameIds: [2, 4] },
    ],
  }));
  const response = await handleDirectory(new Request("https://app.test/api/directory"), deps);
  expect(await response.json()).toEqual({
    shards: [
      { ...shards[0], games: [games[0]] },
      { ...shards[1], games: [games[1]] },
    ],
  });
  const history = await handleDirectoryHistory(new Request("https://app.test/api/directory/history"), deps);
  expect(await history.json()).toEqual({
    games: [{ ...games[3], chainId: "0x2", shardUrl: "https://second.test" }],
    next: null,
    failures: [],
  });
});
