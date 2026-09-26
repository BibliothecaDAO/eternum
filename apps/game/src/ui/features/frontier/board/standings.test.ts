import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it } from "vitest";
import { depthArt } from "../depth-art";
import { boardRows, ownRank, wholeLords, wholeResource } from "./standings";

const entry = (rank: number, address = `0x${(0xa00 + rank).toString(16)}`): HeraldFrontierLeaderboardEntry => ({
  address,
  structure_id: String(rank),
  rank,
  sites_cleared: { total: 10 - rank, camps: 0, rifts: 0, fallen_realms: 0 },
  chests_earned: 0,
  rewards: { lords: "0", essence: "0", labor: "0" },
  deepest_depth: 0,
  order: 1,
});

describe("the season standings", () => {
  const board = [entry(1), entry(2), entry(3, "0x0000abc"), entry(4)];

  it("shows the top rows in Herald's order and adds the viewer's row when it ranks below them", () => {
    expect(boardRows(board, "0xabc", 2).map(({ entry, own }) => `${entry.rank}${own ? "*" : ""}`)).toEqual([
      "1",
      "2",
      "3*",
    ]);
    expect(boardRows(board, "0xabc", 3).map(({ entry, own }) => `${entry.rank}${own ? "*" : ""}`)).toEqual([
      "1",
      "2",
      "3*",
    ]);
    expect(boardRows(board, null, 2)).toHaveLength(2);
  });

  it("reads the viewer's rank as unknown while loading and unranked without a realm row", () => {
    expect(ownRank(undefined, "0xabc")).toBeUndefined();
    expect(ownRank(board, "0xABC")).toBe(3);
    expect(ownRank(board, "0xdef")).toBeNull();
  });

  it("reads Herald's amounts in their declared units, and a depth as its portal", () => {
    expect(wholeResource("9000000000000")).toBe(9_000);
    expect(wholeLords("400")).toBe(400);
    expect(depthArt(0)).toBeNull();
    expect(depthArt(2)).toBe("/images/frontier/depths/ethereal-2.svg");
    expect(() => depthArt(4)).toThrow("No depth 4");
  });
});
