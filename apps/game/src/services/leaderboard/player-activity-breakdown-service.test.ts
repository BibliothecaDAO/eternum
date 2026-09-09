import { beforeEach, expect, it, vi } from "vitest";
const { history } = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock("@/runtime/world", () => ({ getActiveWorld: () => ({ worldId: "blitz" }) }));
vi.mock("@/runtime/world/world-directory", () => ({ getWorldById: () => ({ id: "blitz" }), getDefaultWorld: vi.fn() }));
vi.mock("@/runtime/world/herald-http", () => ({ fetchHeraldGameHistory: history }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 28 } }));
import { fetchLeaderboardActivityBreakdowns } from "./player-activity-breakdown-service";

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
const storyFor = (activity: string) => ({
  ...exploration,
  value: {
    ...exploration.value,
    story: { PointsRegisteredStory: { ...exploration.value.story.PointsRegisteredStory, activity } },
  },
});
beforeEach(() => {
  history.mockReset();
  vi.stubEnv("DEV", true);
});

it("fills the breakdown from a real Herald history item, including felt points", async () => {
  history.mockResolvedValue({ items: [exploration], total: 1 });
  const [entry] = await fetchLeaderboardActivityBreakdowns(10);
  expect(entry.address).toBe(exploration.value.owner);
  expect(entry.activityBreakdown.exploration).toEqual({ count: 1, points: 5 });
  expect(entry.totalPoints).toBe(5);
  expect(entry.rank).toBe(1);
  expect(history).toHaveBeenCalledWith({ id: "blitz" }, 28, { limit: 500, model: "StoryEvent", offset: 0 });
});
it("maps every contract variant to its player column", async () => {
  history.mockResolvedValue({
    items: [
      "Exploration",
      "OpenRelicChest",
      "HyperStructureBanditsDefeat",
      "OtherStructureBanditsDefeat",
      "HyperstructureSharePoints",
    ].map(storyFor),
    total: 5,
  });
  const [entry] = await fetchLeaderboardActivityBreakdowns(10);
  expect(Object.values(entry.activityBreakdown)).toEqual(Array.from({ length: 5 }, () => ({ count: 1, points: 5 })));
  expect(entry.totalPoints).toBe(25);
});
it("fails loudly in development when a new contract variant has no column", async () => {
  history.mockResolvedValue({ items: [storyFor("NewPointsActivity")], total: 1 });
  await expect(fetchLeaderboardActivityBreakdowns(10)).rejects.toThrow("unknown activity NewPointsActivity");
});
it("reports unknown variants in production without losing known stories", async () => {
  vi.stubEnv("DEV", false);
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  history.mockResolvedValue({ items: [storyFor("NewPointsActivity"), exploration], total: 2 });
  expect((await fetchLeaderboardActivityBreakdowns(10))[0].totalPoints).toBe(5);
  expect(report).toHaveBeenCalledOnce();
  report.mockRestore();
  vi.unstubAllEnvs();
});
