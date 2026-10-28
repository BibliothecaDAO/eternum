import { expect, it } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import {
  type EventsFilter,
  eventsReads,
  type FeedLens,
  feedReads,
  oneStoryPerAction,
  selectEventStories,
  selectFeedStories,
} from "./event-stories";

/** A story at `at`, its own transaction unless one is given, between the players its payload names. */
const story = (
  id: string,
  at: number,
  kind: string,
  owner: string,
  payload: Record<string, unknown>,
  extra: Partial<ProcessedStoryEvent> = {},
) =>
  ({
    id,
    event_id: `story:v1:madara:0x1:0x7:0x${at.toString(16)}:0x${id.length.toString(16)}`,
    tx_hash: `0x${at.toString(16)}`,
    entity_id: 900,
    timestampMs: at,
    story: kind,
    owner,
    participants: [owner],
    storyPayload: payload,
    ...extra,
  }) as unknown as ProcessedStoryEvent;
const fight = (id: string, at: number, attacker: string, defender: string) =>
  story(
    id,
    at,
    "BattleEvent",
    attacker,
    { attacker: { player: attacker }, defender: { player: defender } },
    {
      participants: [attacker, defender],
    },
  );
const capture = (id: string, at: number, taker: string, holder: string, extra: Partial<ProcessedStoryEvent> = {}) =>
  story(
    id,
    at,
    "StructureCapturedStory",
    taker,
    { previous_owner: holder, new_owner: taker },
    {
      participants: [taker, holder],
      ...extra,
    },
  );

/** The ids Events shows for these stories, as viewer 0x1, with structure 900 a Hyperstructure when `hyper`. */
const ids = (stories: ProcessedStoryEvent[], filter: EventsFilter, hyper = false) =>
  selectEventStories(stories, filter, "0x1", (structureId) => hyper && structureId === 900).map(({ id }) => id);

it("shows the player's fights under Important, another player's only under All, newest first", () => {
  const stories = [
    fight("theirs", 30, "0x7", "0x8"),
    fight("mine", 20, "0x1", "0x2"),
    fight("defended", 10, "0x2", "0x01"),
  ];
  expect(ids(stories, "important")).toEqual(["mine", "defended"]);
  expect(ids(stories, "all")).toEqual(["theirs", "mine", "defended"]);
});

it("shows under Important a crate the player opened and their captures, not a level-up or another's crate", () => {
  const stories = [
    story("crate", 50, "RelicChestOpened", "0x1", {}),
    story("their-crate", 40, "RelicChestOpened", "0x2", {}),
    capture("took", 30, "0x1", "0x0"),
    capture("lost", 20, "0x2", "0x1"),
    story("up", 10, "StructureLevelUpStory", "0x1", {}),
  ];
  expect(ids(stories, "important")).toEqual(["crate", "took", "lost"]);
});

it("shows a Hyperstructure taken by two other players under Important and All, as one row", () => {
  const taken = capture("seized", 30, "0xb", "0xc");
  expect(ids([taken], "important", true)).toEqual(["seized"]);
  expect(ids([taken], "all", true)).toEqual(["seized"]);
  // Another player's camp is not everyone's news.
  expect(ids([taken], "important", false)).toEqual([]);
});

it("tells under Important a capture and the fight that won it, one transaction, as one row by its capture, whichever came first", () => {
  const tx = { tx_hash: "0xc1a" };
  const won = fight("fight", 31, "0x1", "0x2");
  const taken = capture("taken", 30, "0x1", "0x2", tx);
  expect(ids([{ ...won, ...tx }, taken], "important")).toEqual(["taken"]);
  expect(ids([taken, { ...won, ...tx }], "important")).toEqual(["taken"]);
});

it("tells each capture of a structure on its own, however often it changes the same hands", () => {
  const stories = [
    capture("again", 300, "0xb", "0xc"),
    capture("back", 200, "0xc", "0xb"),
    capture("first", 100, "0xb", "0xc"),
  ];
  expect(ids(stories, "all")).toEqual(["again", "back", "first"]);
  expect(ids(stories, "important", true)).toEqual(["again", "back", "first"]);
});

it("shows under All the world's history as it came, every player's routine too, and none of it under Important", () => {
  // Newest on the chain first, as a history read holds them.
  const stories = [
    story("paid", 60, "BuildingPaymentStory", "0x1", { coord: { x: 1, y: 1 } }),
    story("found", 50, "ExplorationReward", "0x1", {}),
    story("raised", 40, "ExplorerCreateStory", "0x1", {}),
    story("made", 30, "ProductionStory", "0x1", {}),
    story("their-level", 20, "StructureLevelUpStory", "0x2", {}),
  ];
  expect(ids(stories, "all")).toEqual(["paid", "found", "raised", "made", "their-level"]);
  expect(ids(stories, "important")).toEqual([]);
});

it("lists a building placed and paid for in one transaction once, and two buildings twice", () => {
  const building = (index: number, kind: string, x: number, extra: Record<string, unknown>) =>
    ({
      id: `b${index}`,
      event_id: `story:v2:madara:0x1:0x7:0xfeed:0x${index.toString(16)}`,
      story: kind,
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

it("reads under Important the player's fights, raids, captures, crates and relic activations, and each Hyperstructure's captures", () => {
  expect(eventsReads("important", "0x1", [900, 901])).toEqual([
    { limit: 100, story: "BattleEvent", owner: "0x1" },
    { limit: 100, story: "RaidEvent", owner: "0x1" },
    { limit: 100, story: "StructureCapturedStory", owner: "0x1" },
    { limit: 100, story: "RelicChestOpened", owner: "0x1" },
    { limit: 100, story: "RelicActivated", owner: "0x1" },
    { limit: 100, story: "RewardChestOpened", owner: "0x1" },
    { limit: 100, story: "StructureCapturedStory", entityId: 900 },
    { limit: 100, story: "StructureCapturedStory", entityId: 901 },
  ]);
  expect(eventsReads("important", null, [900])).toEqual([
    { limit: 100, story: "StructureCapturedStory", entityId: 900 },
  ]);
});

it("reads under All one read of the world's newest stories, whoever the viewer is", () => {
  expect(eventsReads("all", "0x1", [900])).toEqual([{ limit: 350 }]);
  expect(eventsReads("all", null, [])).toEqual([{ limit: 350 }]);
});

/** The ids Frontier's Feed shows through a lens, as player 0x1. */
const feedIds = (stories: ProcessedStoryEvent[], lens: FeedLens) =>
  selectFeedStories(stories, lens, "0x1").map(({ id }) => id);

it("shows in the Feed's Important anyone's fights, clears and chests, and in Mine the player's own, routine too", () => {
  // Owner, 27 October: "All / Important (battles but not just mine), then mine".
  const stories = [
    fight("their-fight", 60, "0x7", "0x8"),
    story("their-clear", 50, "SitePayout", "0x8", { site_id: 5 }),
    story("my-explore", 40, "ExplorationReward", "0x1", {}),
    fight("my-fight", 30, "0x1", "0x2"),
    story("their-explore", 20, "ExplorationReward", "0x7", {}),
    story("their-chest", 10, "RewardChestOpened", "0x9", {}),
  ];
  expect(feedIds(stories, "all")).toEqual([
    "their-fight",
    "their-clear",
    "my-explore",
    "my-fight",
    "their-explore",
    "their-chest",
  ]);
  // Notable stories, anyone's; never a routine explore, the player's or another's.
  expect(feedIds(stories, "important")).toEqual(["their-fight", "their-clear", "my-fight", "their-chest"]);
  // The player's own, whatever it is: their explore and their fight, nobody else's.
  expect(feedIds(stories, "mine")).toEqual(["my-explore", "my-fight"]);
  // A fight the player was attacked in is theirs too.
  expect(feedIds([fight("attacked", 5, "0x7", "0x1")], "mine")).toEqual(["attacked"]);
});

it("reads for the Feed's lenses the world, each notable kind from anyone, or the player's own", () => {
  expect(feedReads("all", "0x1")).toEqual([{ limit: 350 }]);
  expect(feedReads("important", "0x1").map(({ story, owner }) => [story, owner])).toEqual([
    ["BattleEvent", undefined],
    ["RaidEvent", undefined],
    ["StructureCapturedStory", undefined],
    ["SitePayout", undefined],
    ["RewardChestOpened", undefined],
    ["RelicChestOpened", undefined],
  ]);
  expect(feedReads("mine", "0x1")).toEqual([{ limit: 100, owner: "0x1" }]);
  // A spectator holds nothing of their own to read.
  expect(feedReads("mine", null)).toEqual([]);
});
