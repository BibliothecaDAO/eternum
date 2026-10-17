import { TransactionType } from "@bibliothecadao/provider";
import { expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRows } from "./event-feed-rows";
import { formatFeedTime, oneStoryPerAction, selectImportantFeedRows, selectQuickFeedRows } from "./important-feed-rows";
const empty: FeedRows = { inFlight: [], arrived: [], recent: [] };
const battle = (id: string, at: number, owner = "0x1") =>
  ({
    id,
    event_id: `story:v1:madara:0x1:0x7:0x99:0x${(at * 2 + (owner === "0x2" ? 1 : 0)).toString(16)}`,
    entity_id: owner === "0x2" ? 22 : 11,
    timestampMs: at,
    story: "BattleEvent",
    owner,
    storyPayload: { attacker_id: 11, defender_id: 22, attacker: { player: "0x1" }, defender: { player: "0x2" } },
  }) as unknown as ProcessedStoryEvent;

it("keeps the production feed usable when a newer server emits an unknown story", () => {
  vi.stubEnv("NODE_ENV", "production");
  try {
    const future = { ...battle("future", 30), story: "FutureStory" };
    expect(selectImportantFeedRows([future, battle("fight", 20)], empty, "all", null).map((row) => row.id)).toEqual([
      "story:fight",
    ]);
  } finally {
    vi.unstubAllEnvs();
  }
});

it("keeps battles/captures and drops routine army activity", () => {
  const move = { ...battle("move", 30), story: "ExplorerCreateStory" };
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
it("formats a row time as HH:MM", () => {
  expect(formatFeedTime(new Date(2026, 8, 9, 14, 5).getTime())).toBe("14:05");
});

it("keeps only the newest rows inside the quick feed window", () => {
  const rows = selectImportantFeedRows(
    [battle("fresh", 100_000), battle("older", 85_000), battle("stale", 70_000), battle("future", 101_000)],
    empty,
    "all",
    null,
  );
  const ids = (maxRows: number) =>
    selectQuickFeedRows(rows, 100_500, new Map(), 20_000, maxRows).visible.map((row) => row.id);
  expect(ids(5)).toEqual(["story:future", "story:fresh", "story:older"]);
  expect(ids(1)).toEqual(["story:future"]);
});

it("keeps a row its whole window from when it first shows, however late its story arrived, then drops it", () => {
  // The story is stamped at its block (90 s) and reaches the client 10 s later (100 s).
  const rows = selectImportantFeedRows([battle("late", 90_000)], empty, "all", null);
  const show = (nowMs: number, firstShown = new Map<string, number>()) =>
    selectQuickFeedRows(rows, nowMs, firstShown, 20_000, 5);
  const first = show(100_000);
  expect(first.visible.map((row) => row.id)).toEqual(["story:late"]);
  expect(show(119_000, new Map(first.firstShown)).visible.map((row) => row.id)).toEqual(["story:late"]);
  expect(show(120_000, new Map(first.firstShown)).visible).toEqual([]);
  // A row already past the window when the card first sees it (history after a reload) never shows.
  expect(show(111_000).visible).toEqual([]);
});
it("lists a building placed and paid for in one transaction once, and two buildings twice", () => {
  const building = (index: number, story: string, x: number, extra: Record<string, unknown>) =>
    ({
      id: `b${index}`,
      event_id: `story:v2:madara:0x1:0x7:0xfeed:0x${index.toString(16)}`,
      story,
      owner: "0x1",
      storyPayload: { coord: { x, y: 5 }, category: 2, ...extra },
    }) as unknown as ProcessedStoryEvent;
  // Newest on the chain first: each payment follows its placement in the receipt.
  const stories = [
    building(4, "BuildingPaymentStory", 6, { cost: [] }),
    building(3, "BuildingPlacementStory", 6, { change: "Created" }),
    building(2, "BuildingPaymentStory", 4, { cost: [] }),
    building(1, "BuildingPlacementStory", 4, { change: "Created" }),
  ];
  expect(oneStoryPerAction(stories).map((event) => event.id)).toEqual(["b4", "b2"]);
});
