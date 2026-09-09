import { TransactionType } from "@bibliothecadao/provider";
import { expect, it } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRows } from "./event-feed-rows";
import { groupFeedRowsByTick, resolveGameTick, selectImportantFeedRows, selectQuickFeedRows } from "./important-feed-rows";
const empty: FeedRows = { inFlight: [], arrived: [], recent: [] };
const battle = (id: string, at: number, owner = "0x1") =>
  ({
    id,
    timestampMs: at,
    story: "BattleStory",
    owner,
    storyPayload: { attacker_owner_address: "0x1", defender_owner_address: "0x2" },
  }) as unknown as ProcessedStoryEvent;

it("keeps battles/captures and drops routine movement", () => {
  const move = { ...battle("move", 30), story: "ExplorerMoveStory" };
  expect(selectImportantFeedRows([move, battle("fight", 20)], empty, "all", null).map((row) => row.id)).toEqual([
    "story:fight",
  ]);
});
it("mine includes battles where the player defended, with normalized felt addresses", () => {
  expect(selectImportantFeedRows([battle("fight", 20)], empty, "mine", "0x02")).toHaveLength(1);
  expect(selectImportantFeedRows([battle("fight", 20)], empty, "mine", "0x03")).toHaveLength(0);
});
it("combat excludes personal failures and arrivals", () => {
  const feed = {
    ...empty,
    arrived: [{ kind: "arrival", id: "caravan", at: 30 }],
    recent: [{ kind: "transaction", id: "failed", at: 40, transaction: { status: "reverted" } }],
  } as unknown as FeedRows;
  expect(selectImportantFeedRows([battle("fight", 20)], feed, "all", null).map((row) => row.id)).toEqual([
    "failed",
    "caravan",
    "story:fight",
  ]);
  expect(selectImportantFeedRows([battle("fight", 20)], feed, "combat", null).map((row) => row.id)).toEqual([
    "story:fight",
  ]);
});
it("groups by configured army ticks, newest tick and newest event first", () => {
  const rows = selectImportantFeedRows(
    [battle("old", 60_000), battle("new", 125_000), battle("middle", 120_000)],
    empty,
    "all",
    null,
  );
  const tickOf = (at: number) => resolveGameTick(at, null, 60);
  expect(groupFeedRowsByTick(rows, tickOf).map((group) => [group.tick, group.rows.map((row) => row.id)])).toEqual([
    [2, ["story:new", "story:middle"]],
    [1, ["story:old"]],
  ]);
  expect(() => resolveGameTick(60_000, null, 0)).toThrow("configured army tick");
});

it("counts ticks from the game start once it is known", () => {
  expect(resolveGameTick(600_000, 540, 60)).toBe(2);
  expect(resolveGameTick(540_000, 540, 60)).toBe(1);
});

it("keeps only the newest rows inside the quick feed window", () => {
  const rows = selectImportantFeedRows(
    [battle("fresh", 100_000), battle("older", 85_000), battle("stale", 70_000), battle("future", 101_000)],
    empty,
    "all",
    null,
  );
  expect(selectQuickFeedRows(rows, 100_500, 20_000, 5).map((row) => row.id)).toEqual(["story:fresh", "story:older"]);
  expect(selectQuickFeedRows(rows, 100_500, 20_000, 1).map((row) => row.id)).toEqual(["story:fresh"]);
});

it("shows one battle when Herald records a story for each participant", () => {
  const attacker = battle("attacker", 20);
  const defender = { ...attacker, id: "defender", owner: "0x2" };
  expect(selectImportantFeedRows([attacker, defender], empty, "all", null)).toHaveLength(1);
});

it("keeps pending and completed actions and travelling caravans in Events", () => {
  const feed = {
    inFlight: [
      { kind: "arrival", id: "travelling", at: 50 },
      { kind: "transaction", id: "pending", at: 40, transaction: { status: "pending", type: TransactionType.SEND } },
    ],
    arrived: [],
    recent: [
      { kind: "transaction", id: "done", at: 30, transaction: { status: "success" } },
      { kind: "notice", id: "notice", at: 20 },
    ],
  } as unknown as FeedRows;
  expect(selectImportantFeedRows([], feed, "mine", "0x1").map((row) => row.id)).toEqual([
    "travelling",
    "pending",
    "done",
    "notice",
  ]);
});

it("leaves routine production in Activity but keeps failed and stuck production visible", () => {
  const production = (id: string, status: "pending" | "success" | "reverted", isStuck = false) => ({
    kind: "transaction" as const,
    id,
    at: 10,
    isStuck,
    transaction: {
      hash: id,
      submittedAt: 10,
      description: "Converted resources",
      status,
      type: TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
    },
  });
  const feed: FeedRows = {
    arrived: [],
    inFlight: [production("pending", "pending"), production("stuck", "pending", true)],
    recent: [production("done", "success"), production("failed", "reverted")],
  };
  expect(selectImportantFeedRows([], feed, "all", "0x1").map((row) => row.id)).toEqual(["stuck", "failed"]);
  expect(feed.recent).toHaveLength(2);
});
