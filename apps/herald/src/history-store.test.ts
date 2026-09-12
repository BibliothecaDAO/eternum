import { GAME_SYNC_MODEL_MANIFEST } from "@bibliothecadao/eternum/game-sync-models";
import { beforeEach, expect, it, vi } from "vitest";
import type { DecodedWorldEvent } from "./types";
const db = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), release: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    query = db.query;
    connect = async () => ({ query: db.transaction, release: db.release });
  },
}));
import { HistoryStore } from "./history-store";

const value = {
  story: { PointsRegisteredStory: { owner_address: "0xabc", activity: "Exploration", points: "0x4c4b40" } },
};
const event = {
  kind: "event",
  model: GAME_SYNC_MODEL_MANIFEST.find((model) => model.name === "StoryEvent")!,
  key: { game_id: "0x1c" },
  value,
  entityId: "0x1",
  position: { blockNumber: 365589, transactionHash: "0x123", transactionIndex: 0, eventIndex: 19 },
} satisfies DecodedWorldEvent;

beforeEach(() => {
  db.query.mockReset();
  db.transaction.mockReset();
  db.release.mockReset();
});

it("rejects a StoryEvent without its game identity before advancing history", async () => {
  const store = new HistoryStore("postgres://test", "madara", "0x123");
  await expect(store.appendBackfilledEvents([{ ...event, key: {} }], 365589)).rejects.toThrow(
    "StoryEvent is missing game_id",
  );
  expect(db.transaction).not.toHaveBeenCalled();
});

it("does not publish a live head as complete while startup history is still being backfilled", async () => {
  db.transaction.mockResolvedValue({ rows: [] });
  const store = new HistoryStore("postgres://test", "madara", "0x123");
  await store.appendEvents([event], 365590);
  expect(db.transaction.mock.calls.some(([sql]) => sql.includes("INSERT INTO herald_history_progress"))).toBe(false);
});

it("does not trust completion markers written before contiguous history tracking", async () => {
  db.query.mockResolvedValue({ rows: [{ complete_through_block: "365590", contiguous: false }] });
  const store = new HistoryStore("postgres://test", "madara", "0x123");
  expect(await store.historyProgress()).toBeNull();
});
it("restores points after restart, counts only new SQL rows and serves without more database reads", async () => {
  db.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT game_id") ? [{ game_id: "28", value }] : [],
  }));
  let insertCount = 0;
  db.transaction.mockImplementation(async (sql: string) => ({
    rows: sql.includes("INSERT INTO herald_history_events") && insertCount++ === 0 ? [{ game_id: "28", value }] : [],
  }));
  const store = new HistoryStore("postgres://test", "madara", "0xworld");
  await store.initialize();
  expect(store.leaderboard("28")).toBeNull();
  store.markLeaderboardReady();
  expect(store.leaderboard("28")?.entries[0].totalPoints).toBe(5);
  await store.appendEvents([event]);
  await store.appendEvents([event]);
  expect(store.leaderboard("28")?.entries[0].activityBreakdown.exploration).toEqual({ count: 2, points: 10 });
  expect(db.transaction.mock.calls.find(([sql]) => sql.includes("INSERT INTO herald_history_events"))?.[0]).toContain(
    "ON CONFLICT DO NOTHING",
  );
  const reads = db.query.mock.calls.length;
  store.leaderboard("28");
  store.leaderboard("28");
  expect(db.query).toHaveBeenCalledTimes(reads);
});
it("does not publish a rolled-back points registration", async () => {
  db.query.mockResolvedValue({ rows: [] });
  db.transaction.mockImplementation(async (sql: string) => {
    if (sql === "COMMIT") throw new Error("commit failed");
    return { rows: sql.includes("INSERT INTO herald_history_events") ? [{ game_id: "28", value }] : [] };
  });
  const store = new HistoryStore("postgres://test", "madara", "0xworld");
  await store.initialize();
  store.markLeaderboardReady();
  await expect(store.appendEvents([event])).rejects.toThrow("commit failed");
  expect(store.leaderboard("28")?.entries).toEqual([]);
  expect(db.transaction).toHaveBeenCalledWith("ROLLBACK");
  expect(db.release).toHaveBeenCalledOnce();
});

it("applies the story variant to both the history count and the bounded page", async () => {
  db.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("COUNT(*)") ? [{ total: "2" }] : [] }));
  const store = new HistoryStore("postgres://test", "madara", "0x123");
  const page = await store.queryEvents({
    gameId: "28",
    model: "StoryEvent",
    story: "BattleStory",
    limit: 350,
    offset: 0,
  });
  const [[countSql, countValues], [pageSql, pageValues]] = db.query.mock.calls;
  expect(countSql).toContain("model = $4 AND value->'story' ? $5");
  expect(pageSql).toContain("model = $4 AND value->'story' ? $5");
  expect(pageSql).toContain("LIMIT $6 OFFSET $7");
  expect(countValues.slice(0, 5)).toEqual(["madara", "0x123", "28", "StoryEvent", "BattleStory"]);
  expect(pageValues.slice(-2)).toEqual([350, 0]);
  expect(page.total).toBe(2);
});
