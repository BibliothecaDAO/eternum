import { TransactionType } from "@bibliothecadao/provider";
import { expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRows } from "./event-feed-rows";
import {
  formatFeedTime,
  type ImportantFeedRow,
  oneStoryPerAction,
  selectImportantFeedRows,
  selectQuickFeedRows,
  sendKey,
} from "./important-feed-rows";
const empty: FeedRows = { inFlight: [], arrived: [], recent: [] };
const battle = (id: string, at: number, owner = "0x1") =>
  ({
    id,
    event_id: `story:v1:madara:0x1:0x7:0x99:0x${(at * 2 + (owner === "0x2" ? 1 : 0)).toString(16)}`,
    tx_hash: `0x${(at * 2 + (owner === "0x2" ? 1 : 0)).toString(16)}`,
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

/** The keys a quick feed draws, top first, from this screen; no send of the client's own unless given. */
const drawn = (
  rows: ImportantFeedRow[],
  nowMs: number,
  shown: string[] = [],
  ended: string[] = [],
  sends: ReadonlySet<string> = new Set(),
) => selectQuickFeedRows(rows, nowMs, { shown, ended: new Set(ended) }, sends, 20_000, 5).map(({ key }) => key);

it("draws only rows still within the window of now, newest on top, capped", () => {
  const rows = selectImportantFeedRows(
    [battle("fresh", 100_000), battle("older", 85_000), battle("stale", 70_000), battle("future", 101_000)],
    empty,
    "all",
    null,
  );
  expect(drawn(rows, 100_500)).toEqual(["story:future", "story:fresh", "story:older"]);
  expect(
    selectQuickFeedRows(rows, 100_500, { shown: [], ended: new Set() }, new Set(), 20_000, 1).map(({ key }) => key),
  ).toEqual(["story:future"]);
});

it("keeps pending and completed actions and travelling caravans in Events", () => {
  const feed = {
    inFlight: [
      { kind: "arrival", id: "travelling", at: 50 },
      {
        kind: "transaction",
        id: "pending",
        at: 40,
        transaction: { hash: "0xpending", status: "pending", type: TransactionType.SEND },
      },
    ],
    arrived: [],
    recent: [
      { kind: "transaction", id: "done", at: 30, transaction: { hash: "0xdone", status: "success" } },
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

it("leaves routine production in Activity but keeps failed and still-checking production visible", () => {
  const production = (id: string, status: "pending" | "checking" | "success" | "reverted") => ({
    kind: "transaction" as const,
    id,
    at: 10,
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
    inFlight: [production("pending", "pending"), production("checking", "checking")],
    recent: [production("done", "success"), production("failed", "reverted")],
  };
  expect(selectImportantFeedRows([], feed, "all", "0x1").map((row) => row.id)).toEqual(["checking", "failed"]);
  expect(feed.recent).toHaveLength(2);
});

const levelUp = (id: string, at: number, owner: string, tx = `0x${id}`) =>
  ({
    ...battle(id, at, owner),
    story: "StructureLevelUpStory",
    owner,
    tx_hash: tx,
    storyPayload: {},
  }) as ProcessedStoryEvent;

it("holds the news of the player's own realms from history, never another player's, and not under Combat", () => {
  const stories = [levelUp("mine", 30, "0x1"), levelUp("theirs", 20, "0x2")];
  expect(selectImportantFeedRows(stories, empty, "all", "0x01").map((row) => row.id)).toEqual(["story:mine"]);
  expect(selectImportantFeedRows(stories, empty, "mine", "0x01").map((row) => row.id)).toEqual(["story:mine"]);
  expect(selectImportantFeedRows(stories, empty, "combat", "0x01")).toEqual([]);
});

it("shows a completed send once its history story arrives as that story, which a reload brings back", () => {
  const send = (hash: string) => ({ kind: "transaction", id: hash, at: 25, transaction: { hash, status: "success" } });
  const feed = { ...empty, recent: [send("0xup"), send("0xother")] } as unknown as FeedRows;
  const story = levelUp("up", 30, "0x1", "0xup");
  expect(selectImportantFeedRows([story], feed, "all", "0x1").map((row) => row.id)).toEqual(["story:up", "0xother"]);
  // After a reload the session's sends are gone; the story is not.
  expect(selectImportantFeedRows([story], empty, "all", "0x1").map((row) => row.id)).toEqual(["story:up"]);
});

it("holds each event once, however many sources reach it", () => {
  const send = { kind: "transaction", id: "0xexplore", at: 25, transaction: { hash: "0xexplore", status: "pending" } };
  const feed = { ...empty, inFlight: [send], recent: [send] } as unknown as FeedRows;
  expect(selectImportantFeedRows([], feed, "all", "0x1").map((row) => row.id)).toEqual(["0xexplore"]);
});

it("keeps a drawn row, in its place, until its own fade ends: no newer row pushes it off, no clock moves it", () => {
  const battles = Array.from({ length: 5 }, (_, index) => battle(`row${index}`, 100_000 - index));
  const rows = selectImportantFeedRows(battles, empty, "all", null);
  const first = drawn(rows, 100_000);
  expect(first).toHaveLength(5);
  // A newer battle arrives while five are drawn: the drawn rows stay, in their order; the newcomer waits for a slot.
  const busier = selectImportantFeedRows([battle("newer", 105_000), ...battles], empty, "all", null);
  expect(drawn(busier, 105_000, first)).toEqual(first);
  // Any chain time, even far past their stamps, leaves them until their fades end.
  expect(drawn(busier, 300_000, first)).toEqual(first);
  // When one fade ends, the newcomer takes a slot on top, if it is still recent, and the rest keep their places.
  expect(drawn(busier, 110_000, first, [first[2]])).toEqual([
    "story:newer",
    ...first.filter((key) => key !== first[2]),
  ]);
  // A row already past the window when it would first be drawn (history after a reload) never comes in.
  expect(drawn(busier, 140_000, [])).toEqual([]);
});

it("keeps a send and the story that tells it as one row: the story takes the send's place and time on screen", () => {
  const send = {
    kind: "transaction",
    id: "0x0abc",
    at: 100_000,
    transaction: { hash: "0x0abc", status: "success", type: TransactionType.ATTACK_EXPLORER_VS_GUARD },
  };
  const sends = new Set([sendKey("0x0abc")]);
  const pending = selectImportantFeedRows([], { ...empty, recent: [send] } as unknown as FeedRows, "all", "0x1");
  const other = selectImportantFeedRows([battle("other", 99_000)], empty, "all", "0x1");
  const before = drawn([...other, ...pending], 100_000, [], [], sends);
  // The story arrives under the send's hash (written without its leading zero); Events now tells the send by it.
  const told = { ...battle("fight", 101_000), tx_hash: "0xabc" } as unknown as ProcessedStoryEvent;
  const after = selectImportantFeedRows(
    [told, battle("other", 99_000)],
    { ...empty, recent: [send] } as unknown as FeedRows,
    "all",
    "0x1",
  );
  expect(after.map((row) => row.id)).not.toContain("0x0abc");
  expect(drawn(after, 102_000, before, [], sends)).toEqual(before);
  expect(selectQuickFeedRows(after, 102_000, { shown: before, ended: new Set() }, sends, 20_000, 5)[0].row.id).toBe(
    "story:fight",
  );
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
