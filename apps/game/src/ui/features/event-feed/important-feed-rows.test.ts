import { expect, it } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRows } from "./event-feed-rows";
import { groupFeedRowsByTick, selectImportantFeedRows } from "./important-feed-rows";
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
  expect(groupFeedRowsByTick(rows, 60).map((group) => [group.tick, group.rows.map((row) => row.id)])).toEqual([
    [2, ["story:new", "story:middle"]],
    [1, ["story:old"]],
  ]);
  expect(() => groupFeedRowsByTick(rows, 0)).toThrow("configured army tick");
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
      { kind: "transaction", id: "pending", at: 40 },
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
