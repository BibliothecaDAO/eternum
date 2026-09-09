import { expect, it } from "vitest";
import { readPointsRegistration } from "@bibliothecadao/eternum/game-sync";
import { PointsLeaderboard } from "./points-leaderboard";
// Herald game 28, block 365589: captured from the public history endpoint on 2026-09-09.
const exploration = {
  block_number: 365589,
  event_index: 19,
  game_id: "28",
  model: "StoryEvent",
  transaction_hash: "0x36f1616130f60083ff3ec01564e7c6a9b242c04893bb4848f8bd8ba18730e0c",
  transaction_index: 0,
  value: {
    id: "0x25925",
    owner: "0x224f49ea3c0fd299a5a2163624955eb7725c030c2dd90caafd27f0db53d7f09",
    story: {
      PointsRegisteredStory: {
        points: "0x4c4b40",
        activity: "Exploration",
        owner_address: "0x224f49ea3c0fd299a5a2163624955eb7725c030c2dd90caafd27f0db53d7f09",
      },
    },
    game_id: "0x1c",
    tx_hash: "0x36f1616130f60083ff3ec01564e7c6a9b242c04893bb4848f8bd8ba18730e0c",
    entity_id: "0x2584a",
    timestamp: "0x6aa11600",
  },
};

it("folds a real history item and every contract activity into player columns", () => {
  const board = new PointsLeaderboard();
  for (const activity of [
    "Exploration",
    "OpenRelicChest",
    "HyperStructureBanditsDefeat",
    "OtherStructureBanditsDefeat",
    "HyperstructureSharePoints",
  ]) {
    const value = {
      ...exploration.value,
      story: { PointsRegisteredStory: { ...exploration.value.story.PointsRegisteredStory, activity } },
    };
    board.accept(exploration.game_id, readPointsRegistration(value)!);
  }
  const [entry] = board.snapshot("0x1c").entries;
  expect(entry.address).toBe(exploration.value.owner);
  expect(Object.values(entry.activityBreakdown)).toEqual(Array.from({ length: 5 }, () => ({ count: 1, points: 5 })));
  expect(entry.totalPoints).toBe(25);
  expect(entry.rank).toBe(1);
  expect(board.snapshot("29").entries).toEqual([]);
  entry.activityBreakdown.exploration.points = 999;
  expect(board.snapshot("28").entries[0].activityBreakdown.exploration.points).toBe(5);
});
it("rejects unknown variants instead of dropping points", () => {
  expect(() =>
    readPointsRegistration({
      story: { PointsRegisteredStory: { ...exploration.value.story.PointsRegisteredStory, activity: "NewActivity" } },
    }),
  ).toThrow("Unknown points activity: NewActivity");
});
it("ranks players by their accumulated points", () => {
  const board = new PointsLeaderboard();
  board.accept("28", { address: "0x1", activity: "exploration", points: 5 });
  board.accept("28", { address: "0x2", activity: "openRelicChest", points: 250 });
  expect(board.snapshot("28").entries.map(({ address, rank }) => ({ address, rank }))).toEqual([
    { address: "0x2", rank: 1 },
    { address: "0x1", rank: 2 },
  ]);
});
