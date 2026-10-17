import { TransactionType } from "@bibliothecadao/provider";
import { expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRows } from "./event-feed-rows";
import {
  type ImportantFeedRow,
  oneStoryPerAction,
  type EventsFilter,
  latestActions,
  type ShownRow,
  selectImportantFeedRows,
  sendKey,
} from "./important-feed-rows";
import type { Headline } from "../news-headlines/headline-types";
const empty: FeedRows = { inFlight: [], recent: [] };
const battle = (id: string, at: number, owner = "0x1") =>
  ({
    id,
    event_id: `story:v1:madara:0x1:0x7:0x99:0x${(at * 2 + (owner === "0x2" ? 1 : 0)).toString(16)}`,
    tx_hash: `0x${(at * 2 + (owner === "0x2" ? 1 : 0)).toString(16)}`,
    participants: ["0x1", "0x2"],
    entity_id: owner === "0x2" ? 22 : 11,
    timestampMs: at,
    story: "BattleEvent",
    owner,
    storyPayload: { attacker_id: 11, defender_id: 22, attacker: { player: "0x1" }, defender: { player: "0x2" } },
  }) as unknown as ProcessedStoryEvent;

/** A battle between two other players. */
const theirs = (id: string, at: number) =>
  ({
    ...battle(id, at),
    owner: "0x7",
    participants: ["0x7", "0x8"],
    storyPayload: { attacker: { player: "0x7" }, defender: { player: "0x8" } },
  }) as ProcessedStoryEvent;

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
it("shows under Important the player's fights and refused orders, not other players' fights or done orders", () => {
  const feed = {
    ...empty,
    recent: [
      { kind: "transaction", id: "failed", at: 40, transaction: { hash: "0xf1", status: "reverted" } },
      { kind: "transaction", id: "done", at: 35, transaction: { hash: "0xd1", status: "success" } },
    ],
  } as unknown as FeedRows;
  const fights = [battle("mine", 20), theirs("theirs", 30)];
  expect(selectImportantFeedRows(fights, feed, "important", "0x1").map((row) => row.id)).toEqual([
    "failed",
    "story:mine",
  ]);
  expect(selectImportantFeedRows(fights, feed, "mine", "0x1").map((row) => row.id)).toEqual([
    "failed",
    "done",
    "story:mine",
  ]);
  expect(selectImportantFeedRows(fights, feed, "all", "0x1").map((row) => row.id)).toEqual([
    "failed",
    "done",
    "story:theirs",
    "story:mine",
  ]);
});

it("shows the game's milestones under Important, not a tier-three building, and no headline under Mine", () => {
  const headline = (id: string, type: Headline["type"]) =>
    ({ id, type, title: id, description: id, icon: type, timestamp: 50 }) as Headline;
  const headlines = [
    headline("start", "game-start"),
    headline("hyper", "hyper-capture"),
    headline("t3", "t3-building"),
  ];
  const ids = (filter: EventsFilter) =>
    selectImportantFeedRows([], empty, filter, "0x1", headlines).map((row) => row.id);
  expect(ids("important")).toEqual(["start", "hyper"]);
  expect(ids("mine")).toEqual([]);
  expect(ids("all")).toEqual(["start", "hyper", "t3"]);
});

it("shows under Important a crate the player opened, and their captures; not a level-up or another's crate", () => {
  const story = (id: string, at: number, kind: string, owner: string, payload: Record<string, unknown> = {}) =>
    ({
      ...battle(id, at, owner),
      story: kind,
      owner,
      participants: [owner],
      storyPayload: payload,
    }) as ProcessedStoryEvent;
  const stories = [
    story("crate", 10, "RelicChestOpened", "0x1"),
    story("their-crate", 20, "RelicChestOpened", "0x2"),
    story("took", 30, "StructureCapturedStory", "0x1", { previous_owner: "0x0" }),
    story("lost", 40, "StructureCapturedStory", "0x2", { previous_owner: "0x1" }),
    story("up", 50, "StructureLevelUpStory", "0x1"),
  ];
  const important = selectImportantFeedRows(stories, empty, "important", "0x1").map((row) => row.id);
  expect(important.toSorted()).toEqual(["story:crate", "story:lost", "story:took"]);
});
it("keeps pending and completed actions in Events", () => {
  const feed = {
    inFlight: [
      {
        kind: "transaction",
        id: "pending",
        at: 40,
        transaction: { hash: "0xpending", status: "pending", type: TransactionType.SEND },
      },
    ],
    recent: [
      { kind: "transaction", id: "done", at: 30, transaction: { hash: "0xdone", status: "success" } },
      { kind: "notice", id: "notice", at: 20 },
    ],
  } as unknown as FeedRows;
  expect(selectImportantFeedRows([], feed, "mine", "0x1").map((row) => row.id)).toEqual(["pending", "done", "notice"]);
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

it("holds the news of the player's own realms from history, never another player's, and not under Important", () => {
  const stories = [levelUp("mine", 30, "0x1"), levelUp("theirs", 20, "0x2")];
  expect(selectImportantFeedRows(stories, empty, "all", "0x01").map((row) => row.id)).toEqual(["story:mine"]);
  expect(selectImportantFeedRows(stories, empty, "mine", "0x01").map((row) => row.id)).toEqual(["story:mine"]);
  expect(selectImportantFeedRows(stories, empty, "important", "0x01")).toEqual([]);
});

it("holds a capture for both sides, from history, so a player who was away finds the realm they lost", () => {
  const capture = (owner: string, previousOwner: string, at: number) =>
    ({
      ...battle(`taken-from-${previousOwner}`, at, owner),
      story: "StructureCapturedStory",
      storyPayload: { previous_owner: previousOwner, new_owner: owner },
    }) as ProcessedStoryEvent;
  const lost = capture("0x7", "0x1", 30);
  const elsewhere = capture("0x7", "0x8", 31);
  expect(selectImportantFeedRows([lost, elsewhere], empty, "mine", "0x1").map((row) => row.id)).toEqual([
    "story:taken-from-0x1",
  ]);
  expect(selectImportantFeedRows([lost, elsewhere], empty, "all", "0x1")).toHaveLength(2);
});

it("shows a completed send once its history story arrives as that story, which a reload brings back", () => {
  const send = (hash: string) => ({ kind: "transaction", id: hash, at: 25, transaction: { hash, status: "success" } });
  const feed = { ...empty, recent: [send("0xup"), send("0xother")] } as unknown as FeedRows;
  const story = levelUp("up", 30, "0x1", "0xup");
  expect(selectImportantFeedRows([story], feed, "all", "0x1").map((row) => row.id)).toEqual(["story:up", "0xother"]);
  // After a reload the session's sends are gone; the story is not.
  expect(selectImportantFeedRows([story], empty, "all", "0x1").map((row) => row.id)).toEqual(["story:up"]);
});

it("tells a done send by the story it wrote, whatever its level, but leaves a routine send out with its stories", () => {
  const send = (hash: string, type: TransactionType) => ({
    kind: "transaction",
    id: hash,
    at: 25,
    transaction: { hash, status: "success", type },
  });
  const feed = {
    ...empty,
    recent: [
      send("0xe1", TransactionType.EXPLORE),
      send("0xb1", TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION),
    ],
  } as unknown as FeedRows;
  const found = { ...levelUp("found", 30, "0x1", "0xe1"), story: "ExplorationReward" } as ProcessedStoryEvent;
  const made = { ...levelUp("made", 30, "0x1", "0xb1"), story: "ProductionStory" } as ProcessedStoryEvent;
  expect(selectImportantFeedRows([found, made], feed, "all", "0x1").map((row) => row.id)).toEqual(["story:found"]);
  // Without the send (a reload), the find is world history, not Events.
  expect(selectImportantFeedRows([found], empty, "all", "0x1")).toEqual([]);
});

it("holds each event once, however many sources reach it", () => {
  const send = { kind: "transaction", id: "0xexplore", at: 25, transaction: { hash: "0xexplore", status: "pending" } };
  const feed = { ...empty, inFlight: [send], recent: [send] } as unknown as FeedRows;
  expect(selectImportantFeedRows([], feed, "all", "0x1").map((row) => row.id)).toEqual(["0xexplore"]);
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

const eventsRows = (events: ProcessedStoryEvent[]) => selectImportantFeedRows(events, empty, "all", "0x1");
const keysOf = (shown: ShownRow[]) => shown.map(({ key }) => key);

it("keeps the newest three actions, newest on top, however old: they stay until newer ones replace them", () => {
  const events = Array.from({ length: 5 }, (_, index) => battle(`b${index}`, 1_000 - index * 100));
  const three = latestActions(eventsRows(events), 3);
  expect(keysOf(three)).toEqual(events.slice(0, 3).map((event) => sendKey(event.tx_hash)));
  const newer = battle("newer", 2_000);
  expect(keysOf(latestActions(eventsRows([newer, ...events]), 3))).toEqual(
    [newer, ...events.slice(0, 2)].map((event) => sendKey(event.tx_hash)),
  );
});

it("tells one action once, with its latest words: a send, then the story it wrote, is one row", () => {
  const send = {
    kind: "transaction",
    id: "0x0abc",
    at: 100_000,
    transaction: { hash: "0x0abc", status: "success", type: TransactionType.ATTACK_EXPLORER_VS_GUARD },
  };
  const sending = latestActions(
    selectImportantFeedRows([], { ...empty, recent: [send] } as unknown as FeedRows, "all", "0x1"),
    3,
  );
  const story = { ...battle("fight", 101_000), tx_hash: "0xabc" } as unknown as ProcessedStoryEvent;
  const told = latestActions(
    selectImportantFeedRows([story], { ...empty, recent: [send] } as unknown as FeedRows, "all", "0x1"),
    3,
  );
  expect(keysOf(told)).toEqual(keysOf(sending));
  expect(told.map(({ row }) => row.id)).toEqual(["story:fight"]);
});
