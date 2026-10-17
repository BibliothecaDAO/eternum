import { TransactionType } from "@bibliothecadao/provider";
import { expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRows } from "./event-feed-rows";
import {
  endQuickFeedRow,
  type ImportantFeedRow,
  nextQuickFeed,
  oneStoryPerAction,
  type QuickFeed,
  selectImportantFeedRows,
  sendKey,
} from "./important-feed-rows";
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
it("combat excludes personal failures", () => {
  const feed = {
    ...empty,
    recent: [{ kind: "transaction", id: "failed", at: 40, transaction: { status: "reverted" } }],
  } as unknown as FeedRows;
  expect(selectImportantFeedRows([battle("fight", 20)], feed, "all", null).map((row) => row.id)).toEqual([
    "failed",
    "story:fight",
  ]);
  expect(selectImportantFeedRows([battle("fight", 20)], feed, "combat", null).map((row) => row.id)).toEqual([
    "story:fight",
  ]);
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

/** Events' short list after these rows arrive at `nowMs`, as the player 0x1 sees it. */
const quick = (feed: QuickFeed, rows: ImportantFeedRow[], nowMs: number) =>
  nextQuickFeed(feed, rows, { nowMs, address: "0x1", windowMs: 20_000, maxRows: 5 });
const keysOf = (feed: QuickFeed) => feed.shown.map(({ key }) => key);
const empty_: QuickFeed = { shown: [], ended: [] };
/** A battle between two other players. */
const theirs = (id: string, at: number) =>
  ({
    ...battle(id, at),
    owner: "0x7",
    participants: ["0x7", "0x8"],
    storyPayload: { attacker: { player: "0x7" }, defender: { player: "0x8" } },
  }) as ProcessedStoryEvent;
const eventsRows = (events: ProcessedStoryEvent[]) => selectImportantFeedRows(events, empty, "all", "0x1");

it("shows rows still within the window of now, newest on top, five at most; the rest wait", () => {
  const events = Array.from({ length: 7 }, (_, index) => theirs(`t${index}`, 100_000 - index * 1_000));
  const feed = quick(empty_, eventsRows([...events, theirs("stale", 70_000)]), 100_500);
  expect(keysOf(feed)).toEqual(events.slice(0, 5).map((event) => sendKey(event.tx_hash)));
});

it("gives the player's news the slot of the oldest row not about them at once; theirs never displaces it", () => {
  const unrelated = Array.from({ length: 5 }, (_, index) => theirs(`t${index}`, 100_000 - index));
  const full = quick(empty_, eventsRows(unrelated), 100_000);
  const mine = battle("mine", 101_000);
  const withMine = quick(full, eventsRows([mine, ...unrelated]), 101_000);
  expect(keysOf(withMine)).toEqual([sendKey(mine.tx_hash), ...keysOf(full).slice(0, 4)]);
  // The displaced row's time on screen is over: it never comes back.
  expect(withMine.ended).toEqual([keysOf(full)[4]]);
  // Another unrelated battle waits: it neither displaces the player's row nor anyone else.
  const later = quick(withMine, eventsRows([theirs("t9", 102_000), mine, ...unrelated]), 102_000);
  expect(keysOf(later)).toEqual(keysOf(withMine));
});

it("keeps one row per action across send, story and the sources dropping it, and never brings an ended one back", () => {
  const send = {
    kind: "transaction",
    id: "0x0abc",
    at: 100_000,
    transaction: { hash: "0x0abc", status: "success", type: TransactionType.ATTACK_EXPLORER_VS_GUARD },
  };
  const sending = quick(
    empty_,
    selectImportantFeedRows([], { ...empty, recent: [send] } as unknown as FeedRows, "all", "0x1"),
    100_000,
  );
  const story = { ...battle("fight", 101_000), tx_hash: "0xabc" } as unknown as ProcessedStoryEvent;
  const told = quick(sending, eventsRows([story]), 101_000);
  expect(keysOf(told)).toEqual(keysOf(sending));
  expect(told.shown[0].row.id).toBe("story:fight");
  // Every source drops it: it stays, with its last words, until its fade ends.
  const dropped = quick(told, [], 110_000);
  expect(dropped.shown.map(({ row }) => row.id)).toEqual(["story:fight"]);
  // Its fade ends; it never returns, whatever source brings it back while it is still recent.
  const over = endQuickFeedRow(dropped, keysOf(dropped)[0]);
  expect(keysOf(quick(over, eventsRows([story]), 112_000))).toEqual([]);
});

it("stays bounded and never starves the player's news under a sustained flood of other battles", () => {
  let feed: QuickFeed = empty_;
  const events: ProcessedStoryEvent[] = [];
  const firstSeen = new Map<string, number>();
  const players = new Set<string>();
  for (let second = 0; second < 120; second++) {
    const now = 100_000 + second * 1_000;
    events.unshift(theirs(`t${second}`, now));
    const mine = second % 15 === 0 ? battle(`mine${second}`, now) : null;
    if (mine) events.unshift(mine);
    if (mine) players.add(sendKey(mine.tx_hash));
    feed = quick(feed, eventsRows(events.slice(0, 350)), now);
    for (const { key } of feed.shown) if (!firstSeen.has(key)) firstSeen.set(key, now);
    // The player's battle is on screen the moment it lands, and at most five rows stay at once.
    if (mine) expect(keysOf(feed)).toContain(sendKey(mine.tx_hash));
    expect(feed.shown.length).toBeLessThanOrEqual(5);
    // No player's row is ever displaced: none ends before its 20 s.
    expect(feed.ended.filter((key) => players.has(key) && now - firstSeen.get(key)! < 20_000)).toEqual([]);
    // Each row's fade ends 20 s after it was first shown.
    for (const { key } of feed.shown) if (now - firstSeen.get(key)! >= 20_000) feed = endQuickFeedRow(feed, key);
  }
  expect(players.size).toBe(8);
});
