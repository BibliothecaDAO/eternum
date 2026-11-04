import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it } from "vitest";
import { findOwnEntry, ownRank, wholeLords, earnedResource } from "./standings";

const entry = (rank: number, address = `0x${(0xa00 + rank).toString(16)}`): HeraldFrontierLeaderboardEntry => ({
  address,
  structure_id: String(rank),
  campaign: null,
  rank,
  sites_cleared: { total: 10 - rank, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
  chests_earned: 0,
  rewards: { lords: "0", essence: "0", labor: "0" },
  deepest_depth: 0,
  level: 0,
  order: 1,
});

describe("the season standings", () => {
  const board = [entry(1), entry(2), entry(3, "0x0000abc"), entry(4)];

  it("finds the viewer's own row by canonical address, and none for a spectator", () => {
    expect(findOwnEntry(board, "0xABC")).toBe(board[2]);
    expect(findOwnEntry(board, null)).toBeUndefined();
  });

  it("reads the viewer's rank as unknown while loading and unranked without a realm row", () => {
    expect(ownRank(undefined, "0xabc")).toBeUndefined();
    expect(ownRank(board, "0xABC")).toBe(3);
    expect(ownRank(board, "0xdef")).toBeNull();
  });

  it("reads Herald's amounts in their declared units", () => {
    expect(earnedResource("9000000000000")).toBe(9_000);
    expect(wholeLords("400")).toBe(400);
  });
});
