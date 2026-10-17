import { expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { type EventsFilter, oneStoryPerAction, selectEventStories } from "./event-stories";

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
  story(id, at, "BattleEvent", attacker, { attacker: { player: attacker }, defender: { player: defender } });
const capture = (id: string, at: number, taker: string, holder: string, extra: Partial<ProcessedStoryEvent> = {}) =>
  story(id, at, "StructureCapturedStory", taker, { previous_owner: holder, new_owner: taker }, extra);

/** The ids Events shows for these stories, as viewer 0x1, with structure 900 a Hyperstructure when `hyper`. */
const ids = (stories: ProcessedStoryEvent[], filter: EventsFilter, hyper = false) =>
  selectEventStories(stories, filter, "0x1", (structureId) => hyper && structureId === 900).map(({ id }) => id);

it("keeps the feed usable in production when a newer server emits an unknown story", () => {
  vi.stubEnv("NODE_ENV", "production");
  try {
    expect(ids([story("future", 30, "FutureStory", "0x1", {}), fight("fight", 20, "0x1", "0x2")], "all")).toEqual([
      "fight",
    ]);
  } finally {
    vi.unstubAllEnvs();
  }
});

it("shows the player's fights under Important and Mine, another player's only under All, newest first", () => {
  const stories = [
    fight("theirs", 30, "0x7", "0x8"),
    fight("mine", 20, "0x1", "0x2"),
    fight("defended", 10, "0x2", "0x01"),
  ];
  expect(ids(stories, "important")).toEqual(["mine", "defended"]);
  expect(ids(stories, "mine")).toEqual(["mine", "defended"]);
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
  expect(ids(stories, "mine")).toEqual(["crate", "took", "lost", "up"]);
});

it("shows a Hyperstructure taken by two other players under Important and All, not Mine, as one row", () => {
  const taken = capture("seized", 30, "0xb", "0xc");
  expect(ids([taken], "important", true)).toEqual(["seized"]);
  expect(ids([taken], "mine", true)).toEqual([]);
  expect(ids([taken], "all", true)).toEqual(["seized"]);
  // Another player's camp is not everyone's news.
  expect(ids([taken], "important", false)).toEqual([]);
});

it("tells a capture and the fight that won it, one transaction, as one row by its capture, whichever came first", () => {
  const tx = { tx_hash: "0xc1a" };
  const won = fight("fight", 31, "0x1", "0x2");
  const taken = capture("taken", 30, "0x1", "0x2", tx);
  expect(ids([{ ...won, ...tx }, taken], "all")).toEqual(["taken"]);
  expect(ids([taken, { ...won, ...tx }], "all")).toEqual(["taken"]);
});

it("tells the player's own actions their stories write, and leaves routine production and others' news out", () => {
  const stories = [
    story("paid", 60, "BuildingPaymentStory", "0x1", { coord: { x: 1, y: 1 } }),
    story("found", 50, "ExplorationReward", "0x1", {}),
    story("raised", 40, "ExplorerCreateStory", "0x1", {}),
    story("made", 30, "ProductionStory", "0x1", {}),
    story("their-level", 20, "StructureLevelUpStory", "0x2", {}),
  ];
  expect(ids(stories, "mine")).toEqual(["paid", "found", "raised"]);
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
