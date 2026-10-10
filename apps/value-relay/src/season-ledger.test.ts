import { beforeEach, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { seasonLedgerReads, postSeasonTop, challengeSeason } from "./season-ledger";
const rpc = vi.hoisted(() => ({ block: vi.fn(), events: vi.fn(), call: vi.fn(), execute: vi.fn(), wait: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getBlock: rpc.block, getEvents: rpc.events, callContract: rpc.call, waitForTransaction: rpc.wait }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = rpc.execute;
  },
}));
const target = { rpcUrl: "https://ledger.test", contractAddress: "0x10", accountAddress: "0x20", privateKey: "unused" };
const season = ["0", "0", "3", "2", "1", "0", "3700", "0", "0", "0", "1", "1", "0", "100", "0", "0"];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.block.mockResolvedValue({ block_number: 100, block_hash: "0xa", timestamp: 101, status: "ACCEPTED_ON_L2" });
  rpc.call.mockImplementation(async (request) =>
    request.entrypoint === "get_season"
      ? season
      : request.entrypoint === "get_preset"
        ? [...Array(4).fill("0"), "5000", ...Array(16).fill("0")]
        : request.entrypoint === "get_season_mmr"
          ? ["200"]
          : ["0x2", "0", "0"],
  );
  rpc.execute.mockResolvedValue({ transaction_hash: "0xaa" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("reads the participant and posted streams independently at the pinned confirmed head", async () => {
  rpc.events.mockResolvedValue({
    events: [
      {
        from_address: "0x10",
        keys: [hash.getSelectorFromName("ChestMinted"), "0x1", "7", "0x2"],
        data: ["8", "0", "1", "0"],
        block_number: 90,
      },
    ],
    continuation_token: "more",
  });
  const read = seasonLedgerReads(target);
  expect(await read.changes(0, null, 100)).toEqual({
    rows: [{ kind: "participant", id: 1, wallet: "0x2" }],
    head: 100,
    next: "more",
  });
  expect(await read.season(1, 100)).toMatchObject({
    participantCount: 3,
    topCount: 2,
    paidFraction: 5000,
    reviewUntil: 3700,
  });
  expect(await read.mmr(1, "0x2", 100)).toBe("200");
  expect(await read.winner(1, 0, 100)).toBe("0x2");
  expect(rpc.call.mock.calls.every((call) => call[1] === 100)).toBe(true);
  rpc.events.mockResolvedValue({
    events: [
      {
        from_address: "0x10",
        keys: [hash.getSelectorFromName("SeasonTopPosted"), "1"],
        data: ["2", "3700", "0", "0"],
        block_number: 100,
      },
    ],
  });
  expect(await read.posts(0, null, 100)).toMatchObject({ rows: [{ kind: "posted", id: 1, reviewUntil: 3700 }] });
});
it("confirms the published post_season_top call and rejects a provisional source head", async () => {
  await postSeasonTop(target, 1, ["0x2", "0x3"]);
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "post_season_top",
    calldata: ["1", "2", "0x2", "0x3"],
  });
  rpc.block.mockResolvedValue({ timestamp: 101 });
  await expect(seasonLedgerReads(target).head()).rejects.toThrow("ledger_head_unconfirmed");
});

it("uses the per-season challenge entry and never the global pause", async () => {
  rpc.call.mockResolvedValue(season.map((value, index) => (index === 5 ? "1" : value)));
  await challengeSeason(target, 1, "0x3");
  expect(rpc.execute).toHaveBeenCalledExactlyOnceWith({
    contractAddress: "0x10",
    entrypoint: "challenge_season",
    calldata: ["1", "0x3"],
  });
  rpc.call.mockResolvedValue(season);
  await expect(challengeSeason(target, 1, "0x3")).rejects.toThrow("season_challenge_not_recorded");
});
