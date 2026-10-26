import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { awardFrontierPrizes } from "./frontier-prizes";
const calls = vi.hoisted(() => ({
  admin: vi.fn(),
  funding: vi.fn(),
  header: vi.fn(),
  snapshot: vi.fn(),
  games: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", () => ({ rpcAt: vi.fn(), readFrontierFunding: calls.funding }));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    admin = calls.admin;
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = calls.header;
  },
}));
vi.mock("./frontier-games", () => ({
  readFrontierGames: calls.games,
  frontierTerms: () => ({
    start: 10,
    end: 100,
    seed: "0x1",
    dayUnit: 5,
    claimWindow: 604800,
    chestPoolBps: 7000,
    topN: 3,
  }),
}));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: calls.snapshot,
}));
const target = {
  chainId: "0x1",
  rpcUrl: "https://shard.test",
  gamesAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "0x1",
};
const run = () =>
  awardFrontierPrizes(target, "https://herald.test", { rpcUrl: "https://ledger.test", address: "0x30" });
const snapshot = (issued = "0") => ({
  confirmed_block: 10,
  game_id: "7",
  models: [{ model: "FrontierPrize", rows: [{ value: { pool: "300", issued, count: null } }] }],
});
const board = (addresses = ["0x8", "0x2", "0x5", "0x1"], block = "10") =>
  Response.json(
    { game_id: "7", mode: "frontier", entries: addresses.map((address, index) => ({ address, rank: index + 1 })) },
    { headers: { "X-Confirmed-Block": block } },
  );
beforeEach(() => {
  vi.clearAllMocks();
  calls.games.mockResolvedValue({ confirmedBlock: 10, games: [{ game_id: 7, clock: { end_at: 100 } }] });
  calls.header.mockResolvedValue({ timestamp: 100 });
  calls.snapshot.mockResolvedValue(snapshot());
  calls.funding.mockResolvedValue({ closed: false, claimDeadline: 604900, prizePool: String(300n * 10n ** 18n) });
  calls.admin.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => board()),
  );
});
it("uses the confirmed board's order and issues one guarded withdrawal per winner", async () => {
  await run();
  expect(calls.admin.mock.calls).toEqual([
    ["post_frontier_top", { game_id: 7, winners: ["0x8", "0x2", "0x5"] }],
    ["award_frontier_prize", { game_id: 7, rank: 1 }],
    ["award_frontier_prize", { game_id: 7, rank: 2 }],
    ["award_frontier_prize", { game_id: 7, rank: 3 }],
  ]);
});
it("sends nothing before the season ends or after all awards were issued", async () => {
  calls.header.mockResolvedValueOnce({ timestamp: 99 });
  await run();
  calls.snapshot.mockResolvedValue(snapshot("300"));
  await run();
  expect(calls.admin).not.toHaveBeenCalled();
});
it("keeps fewer entrants and retries an interrupted award batch from the immutable list", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => board(["0x8", "0x2"])),
  );
  calls.admin.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("disconnected"));
  await expect(run()).rejects.toThrow("disconnected");
  await run();
  expect(calls.admin.mock.calls.slice(-3)).toEqual([
    ["post_frontier_top", { game_id: 7, winners: ["0x8", "0x2"] }],
    ["award_frontier_prize", { game_id: 7, rank: 1 }],
    ["award_frontier_prize", { game_id: 7, rank: 2 }],
  ]);
});
it("refuses a board from before the final snapshot", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => board(undefined, "9")),
  );
  await expect(run()).rejects.toThrow("frontier_final_board_before_end");
  expect(calls.admin).not.toHaveBeenCalled();
});
it("refuses duplicate recipients or a prize pool that differs from custody", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => board(["0x2", "0x2"])),
  );
  await expect(run()).rejects.toThrow("frontier_final_board_duplicates");
  calls.funding.mockResolvedValue({ closed: false, claimDeadline: 604900, prizePool: "1" });
  await expect(run()).rejects.toThrow("frontier_prize_differs_from_ledger");
  expect(calls.admin).not.toHaveBeenCalled();
});

afterEach(() => vi.unstubAllGlobals());

it("still issues a reserved prize when the winner returns after the chest claim window", async () => {
  calls.header.mockResolvedValue({ timestamp: 700000 });
  calls.funding.mockResolvedValue({ closed: true, claimDeadline: 604900, prizePool: String(300n * 10n ** 18n) });
  await run();
  expect(calls.admin).toHaveBeenCalledWith("award_frontier_prize", { game_id: 7, rank: 3 });
});

it("does not let an unavailable old season starve another season's prizes", async () => {
  calls.games.mockResolvedValue({
    confirmedBlock: 10,
    games: [
      { game_id: 6, clock: { end_at: 90 } },
      { game_id: 7, clock: { end_at: 100 } },
    ],
  });
  calls.snapshot.mockRejectedValueOnce(new Error("old snapshot unavailable"));
  await expect(run()).rejects.toThrow("old snapshot unavailable");
  expect(calls.admin).toHaveBeenCalledWith("award_frontier_prize", { game_id: 7, rank: 3 });
});

it.each([0, "0x0"])("does not repost an empty final board encoded as %s", async (count) => {
  const empty = snapshot();
  calls.snapshot.mockResolvedValue({
    ...empty,
    models: [{ model: "FrontierPrize", rows: [{ value: { pool: "0x12c", issued: "0x0", count } }] }],
  });
  await run();
  expect(calls.admin).not.toHaveBeenCalled();
  expect(calls.funding).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
