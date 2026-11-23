import { beforeEach, expect, it, vi } from "vitest";
import { settleEndedFrontierGames } from "./frontier-end";

const calls = vi.hoisted(() => ({ games: vi.fn(), settle: vi.fn() }));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    settleGame = calls.settle;
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = async () => ({ timestamp: 100 });
  },
}));
vi.mock("./frontier-games", () => ({ readFrontierGames: calls.games }));

const target = {
  chainId: "0x1",
  rpcUrl: "https://shard.test",
  gamesAddress: "0x10",
  firstRelease: 1,
  accountAddress: "0x20",
  privateKey: "0x1",
};
const game = (game_id: number, end_at: number, status: string) => ({
  game_id,
  mode: "frontier",
  status,
  clock: { end_at },
});

beforeEach(() => {
  vi.clearAllMocks();
  calls.games.mockResolvedValue({
    confirmedBlock: 10,
    games: [game(1, 200, "Live"), game(2, 100, "Live"), game(3, 90, "Ended"), game(4, 50, "Settled")],
  });
});

it("settles every Frontier game whose end has passed and is not settled, so a season with no finisher ends at its end", async () => {
  expect(await settleEndedFrontierGames(target, "https://herald.test")).toEqual([]);
  expect(calls.settle.mock.calls).toEqual([[2], [3]]);
});

it("settles the other ended games when one fails, and returns the failed game with its error", async () => {
  const error = new Error("shard_receipt_unavailable");
  calls.settle.mockRejectedValueOnce(error);
  expect(await settleEndedFrontierGames(target, "https://herald.test")).toEqual([{ game: 2, error }]);
  expect(calls.settle.mock.calls).toEqual([[2], [3]]);
});
