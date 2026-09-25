import { expect, it } from "vitest";
import { createNativeHistoryCodec } from "./native/history";
import { PointsLeaderboard } from "./points-leaderboard";

const { readPoints } = createNativeHistoryCodec({ events: [] } as never);
const PLAYER = "0x224f49ea3c0fd299a5a2163624955eb7725c030c2dd90caafd27f0db53d7f09";
/** A PointsAwarded row as the chain emits it: five points for one activity. */
const award = (activity: string) => ({ player: PLAYER, activity, points: "0x4c4b40" });

it("folds every native points activity into the player's columns", () => {
  const board = new PointsLeaderboard();
  for (const activity of ["Exploration", "RelicChest", "HyperstructureCapture", "StructureCapture", "Hyperstructure"]) {
    board.accept("28", readPoints(award(activity))!);
  }
  const [[address, breakdown]] = [...board.activity("28")];
  expect(address).toBe(PLAYER);
  expect(Object.values(breakdown)).toEqual(Array.from({ length: 5 }, () => ({ count: 1, points: 5 })));
  expect(board.activity("29").size).toBe(0);
  breakdown.exploration.points = 999;
  expect(board.activity("28").get(address)?.exploration.points).toBe(5);
});

it("rejects unknown activities instead of dropping points", () => {
  expect(() => readPoints(award("NewActivity"))).toThrow("Unknown native point activity NewActivity");
});
