import { expect, it, vi } from "vitest";

/** Herald's directory as the shard answers it now: a test may list a new game between reads. */
const reads = vi.hoisted(() => ({ count: 0, games: [{ game_id: 3, name: "blitz-3", preset_id: 1 }] }));
vi.mock("./shards", () => ({ requireOpenShard: async (chainId: string) => ({ url: "https://shard.test", chainId }) }));
vi.mock("@bibliothecadao/eternum/shard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/shard")>()),
  fetchHeraldGameDirectory: async () => {
    reads.count += 1;
    return { chain: "0xa", confirmed_block: 1, games: [...reads.games] };
  },
}));

import { buildGameProfile } from "./profile-builder";
import { readGameEntry } from "./shard-directory";

it("answers screens that read the same shard's directory together from one Herald read", async () => {
  const game = { chainId: "0xa", gameId: 3 };
  const [profile, standing] = await Promise.all([readGameEntry(game, "0x1"), readGameEntry(game, "0x1")]);
  expect(profile).toBe(standing);
  expect(reads.count).toBe(1);
  await expect(readGameEntry({ chainId: "0xa", gameId: 4 }, "0x1")).rejects.toThrow("Shard 0xa lists no game 4");
});

it("lets a reader that accepts an earlier answer reuse it, while the default asks the shard afresh", async () => {
  const game = { chainId: "0xb", gameId: 3 };
  await readGameEntry(game, null);
  const before = reads.count;
  await readGameEntry(game, null, Infinity);
  expect(reads.count).toBe(before);
  await readGameEntry(game, null);
  expect(reads.count).toBe(before + 1);
});

it("builds a new game's profile on a shard whose earlier answer did not list it yet, reusing it for a listed game", async () => {
  await buildGameProfile({ chainId: "0xc", gameId: 3 });
  const before = reads.count;
  // Game 4 is created on the shard after the page read its directory.
  reads.games = [...reads.games, { game_id: 4, name: "blitz-4", preset_id: 2 }];
  await expect(buildGameProfile({ chainId: "0xc", gameId: 4 })).resolves.toMatchObject({
    gameId: 4,
    name: "blitz-4",
    presetId: 2,
  });
  expect(reads.count).toBe(before + 1);
  await buildGameProfile({ chainId: "0xc", gameId: 3 });
  expect(reads.count).toBe(before + 1);
  // A game no answer lists, even the fresh one, is still an error.
  await expect(buildGameProfile({ chainId: "0xc", gameId: 5 })).rejects.toThrow("Shard 0xc lists no game 5");
});
