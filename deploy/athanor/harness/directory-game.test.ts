import { expect, test } from "bun:test";
import { listedFrontierGame } from "./directory-game";

test("plays only a live game listed for the shard, and refuses absent or ambiguous games", async () => {
  const game = {
    game_id: 7,
    name: "calendar-frontier",
    mode: "frontier",
    status: "Live",
    preset_id: 5,
    clock: { start_main_at: 12 },
  };
  let games: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      Response.json({ shards: [{ chainId: "0x1", url: "https://herald.example", status: "active", games }] }),
  });
  const read = (id?: number) =>
    listedFrontierGame(server.url.origin, { chainId: "0x01" }, "https://herald.example/", 5, id);
  try {
    await expect(read()).rejects.toThrow("No live Frontier game is listed");
    games = [game];
    expect(await read()).toEqual({ gameId: 7, gameName: "calendar-frontier", startAt: 12, settlementTransactions: 0 });
    games = [{ ...game, status: "Ended" }];
    await expect(read()).rejects.toThrow("No live Frontier game is listed");
    games = [game, { ...game, game_id: 8 }];
    await expect(read()).rejects.toThrow("Several live Frontier games");
    expect((await read(8)).gameId).toBe(8);
    await expect(
      listedFrontierGame(server.url.origin, { chainId: "0x2" }, "https://herald.example", 5),
    ).rejects.toThrow("No live Frontier game is listed");
  } finally {
    server.stop(true);
  }
});
