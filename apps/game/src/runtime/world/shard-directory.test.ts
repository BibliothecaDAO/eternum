import { expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ count: 0 }));
vi.mock("./shards", () => ({ requireOpenShard: async (chainId: string) => ({ url: "https://shard.test", chainId }) }));
vi.mock("@bibliothecadao/eternum/shard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/shard")>()),
  fetchHeraldGameDirectory: async () => {
    reads.count += 1;
    return { chain: "0xa", confirmed_block: 1, games: [{ game_id: 3, name: "blitz-3" }] };
  },
}));

import { readGameEntry } from "./shard-directory";

it("answers screens that read the same shard's directory together from one Herald read", async () => {
  const game = { chainId: "0xa", gameId: 3 };
  const [profile, standing] = await Promise.all([readGameEntry(game, "0x1"), readGameEntry(game, "0x1")]);
  expect(profile).toBe(standing);
  expect(reads.count).toBe(1);
  await expect(readGameEntry({ chainId: "0xa", gameId: 4 }, "0x1")).rejects.toThrow("Shard 0xa lists no game 4");
});
