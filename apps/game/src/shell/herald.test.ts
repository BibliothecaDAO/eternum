import { expect, it, vi } from "vitest";

const pasted = vi.hoisted(() => ({ shards: [] as { url: string; chainId: string }[] }));
vi.mock("@/runtime/world/shards", () => ({
  listPastedShards: () => pasted.shards,
  openPastedShards: async () => [],
  requireOpenShard: async (chainId: string) => pasted.shards.find((shard) => shard.chainId === chainId),
}));

vi.mock("@bibliothecadao/eternum/shard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/shard")>()),
  // A pasted shard's own Herald answers with every game it has, finished ones included.
  fetchHeraldGameDirectory: async () => ({
    chain: "0xc",
    confirmed_block: 1,
    games: [
      { game_id: 7, status: "Live", clock: { end_at: 900 } },
      { game_id: 5, status: "Settled", clock: { end_at: 500 } },
      { game_id: 6, status: "Settled", clock: { end_at: 600 } },
    ],
  }),
}));

import { type DirectoryGame, fetchDirectories, nextOpenGame, realmsPlayerOf } from "./herald";

const requests: string[] = [];
vi.stubGlobal("fetch", async (input: string) => {
  requests.push(input);
  return Response.json({
    shards: [
      {
        url: "https://shard-a.test",
        chainId: "0xa",
        status: "active",
        games: [{ game_id: 1, mode: "blitz", status: "Live", player_state: { roster_member: true } }],
      },
    ],
  });
});

it("asks our directory for the signed-in player's state on every shard, and for nothing when signed out", async () => {
  // The player is the session's account on our shards, known before any game is joined.
  const guardian = {
    publicKey: "0x20b94f1f60aabd0d7538bc5d78b95829603d1c969220385992772be5283ca76",
    accountClassHash: "0x68995feeefffc1647118073e1ff16179f07eb8eed6c8fb03cce73109f5fbacd",
  };
  const player = realmsPlayerOf("0x4dcca33a9dcd23f3d11f33c2082297968809f3600f2ea26493e52000233bac8", guardian);
  expect(player).toBe("0x5121b91616f6baf21d96ab8a09d92abb155f9c75cad54dd002cc6d082c7bf0");
  expect(realmsPlayerOf(undefined, guardian)).toBeNull();
  const signedIn = await fetchDirectories(player);
  expect(requests).toEqual([`/api/directory?player=${player}`]);
  expect(signedIn.games.map((game) => [game.chainId, game.game_id, game.player_state?.roster_member])).toEqual([
    ["0xa", 1, true],
  ]);
  expect(signedIn.shards).toEqual([{ url: "https://shard-a.test", chainId: "0xa", status: "active", available: true }]);

  requests.splice(0);
  await fetchDirectories(null);
  expect(requests).toEqual(["/api/directory"]);
});

it("keeps a pasted shard's settled games out of the live list and offers them apart, newest first", async () => {
  pasted.shards = [{ url: "https://pasted.test", chainId: "0xc" }];
  try {
    const directory = await fetchDirectories(null);
    expect(directory.games.map((game) => [game.chainId, game.game_id])).toEqual([
      ["0xa", 1],
      ["0xc", 7],
    ]);
    expect(directory.pastedFinished.map((game) => game.game_id)).toEqual([6, 5]);
  } finally {
    pasted.shards = [];
  }
});

it("points the player at a game they can enter now, a live Frontier season first, else the soonest still registering", () => {
  const game = (overrides: Partial<DirectoryGame>) =>
    ({
      chainId: "0xa",
      game_id: 1,
      mode: "blitz",
      status: "Registration",
      ready: false,
      clock: { start_main_at: 500 },
      ...overrides,
    }) as DirectoryGame;
  const registering = game({ game_id: 2, clock: { start_main_at: 400 } } as Partial<DirectoryGame>);
  const season = game({
    game_id: 3,
    mode: "frontier",
    status: "Live",
    ready: true,
    clock: { start_main_at: 100 },
  } as Partial<DirectoryGame>);
  // A live Blitz without the player on its roster is theirs to watch, not to enter.
  const othersBlitz = game({
    game_id: 4,
    status: "Live",
    ready: true,
    clock: { start_main_at: 50 },
  } as Partial<DirectoryGame>);
  expect(nextOpenGame([registering, othersBlitz, season])?.game_id).toBe(3);
  expect(nextOpenGame([registering, othersBlitz])?.game_id).toBe(2);
  // A season still being prepared cannot be entered yet.
  expect(nextOpenGame([{ ...season, ready: false }, registering])?.game_id).toBe(2);
  expect(nextOpenGame([othersBlitz])).toBeUndefined();
});
