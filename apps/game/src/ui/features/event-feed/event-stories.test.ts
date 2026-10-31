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
    { defender_id: 900, attacker: { player: attacker }, defender: { player: defender } },
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

/** A story's place: transaction `tx`, at `index` in its receipt. */
const inReceipt = (tx: string, index: number) => ({
  tx_hash: tx,
  event_id: `story:v2:madara:0x1:0x7:${tx}:0x${index.toString(16)}`,
});
/** A battle between `attacker_id` and `defender_id`, each side's troops before and after, at `index` in `tx`. */
const battle = (
  id: string,
  sides: { attacker_id: number; defender_id: number; attacker: [number, number]; defender: [number, number] },
  tx: string,
  index: number,
  players: [string, string] = ["0x1", "0x2"],
) =>
  story(
    id,
    50,
    "BattleEvent",
    players[0],
    {
      attacker_id: sides.attacker_id,
      defender_id: sides.defender_id,
      attacker: { player: players[0], before: String(sides.attacker[0]), after: String(sides.attacker[1]) },
      defender: { player: players[1], before: String(sides.defender[0]), after: String(sides.defender[1]) },
    },
    { participants: players, ...inReceipt(tx, index) },
  );

it("tells a capture and the fight that won it, one transaction, as one row by its capture, whichever came first", () => {
  // The contract writes the capture, then the battle that caused it: army 41 beat structure 900's last guard.
  const won = battle(
    "fight",
    { attacker_id: 41, defender_id: 900, attacker: [2_000, 1_500], defender: [1_000, 0] },
    "0xc1a",
    4,
  );
  const taken = capture("taken", 30, "0x1", "0x2", inReceipt("0xc1a", 3));
  expect(ids([won, taken], "important")).toEqual(["taken"]);
  expect(ids([taken, won], "important")).toEqual(["taken"]);
  expect(ids([won, taken], "all")).toEqual(["taken"]);
});

it("tells a capture won by a guard that attacked and lost as one row, the capture's, in both Events lenses", () => {
  // guard_attack: structure 900's guard attacks army 41 and falls; the army takes the structure.
  const fight = battle(
    "guard-fight",
    { attacker_id: 900, defender_id: 41, attacker: [1_000, 0], defender: [2_000, 1_500] },
    "0xc1b",
    4,
    ["0x2", "0x1"],
  );
  const taken = capture("capture", 30, "0x1", "0x2", inReceipt("0xc1b", 3));
  expect(ids([fight, taken], "important")).toEqual(["capture"]);
  expect(ids([fight, taken], "all")).toEqual(["capture"]);
});

it("keeps a won fight its own row when another fight in the batch takes the structure", () => {
  // Two guard slots, as the contract writes them: the first battle beats one (no capture yet); then the capture and
  // the battle that beat the last slot, the capture just before its battle, so both battles stand one step from it.
  const first = battle(
    "first-slot",
    { attacker_id: 41, defender_id: 900, attacker: [2_000, 1_800], defender: [500, 0] },
    "0xc1c",
    4,
  );
  const taken = capture("taken", 50, "0x1", "0x2", inReceipt("0xc1c", 5));
  const last = battle(
    "last-slot",
    { attacker_id: 42, defender_id: 900, attacker: [2_000, 1_700], defender: [500, 0] },
    "0xc1c",
    6,
  );
  expect(ids([last, taken, first], "all")).toEqual(["taken", "first-slot"]);
  expect(ids([last, taken, first], "important")).toEqual(["taken", "first-slot"]);
});

it("keeps a guard's attack its own row when it wins: its structure did not fall", () => {
  const held = battle(
    "guard-won",
    { attacker_id: 900, defender_id: 41, attacker: [1_000, 600], defender: [500, 0] },
    "0xc1d",
    4,
    ["0x2", "0x1"],
  );
  const elsewhere = capture("elsewhere", 30, "0x1", "0x3", { ...inReceipt("0xc1d", 3), entity_id: 901 });
  expect(ids([held, elsewhere], "all")).toEqual(["guard-won", "elsewhere"]);
});

/** The ids Frontier's Feed shows through a lens, as player 0x1. */
const feedIds = (stories: ProcessedStoryEvent[], lens: FeedLens) =>
  selectFeedStories(stories, lens, "0x1").map(({ id }) => id);

/**
 * 0x1's army attacking a site's guard, at `index` in transaction `tx`: the guard falls (`cleared`), holds, or beats the
 * army.
 */
const attack = (id: string, site: number, tx: string, index = 2, outcome: "cleared" | "held" | "lost" = "cleared") =>
  battle(
    id,
    {
      attacker_id: 40,
      defender_id: site,
      attacker: [1_000, outcome === "lost" ? 0 : 800],
      defender: [500, outcome === "cleared" ? 0 : 300],
    },
    tx,
    index,
    ["0x1", "0x0"],
  );
/** 0x1's clear of a site, at `index` in transaction `tx`: the contract writes it just before the battle that won it. */
const payout = (id: string, site: number, tx: string, index = 1) =>
  story(id, 50, "SitePayout", "0x1", { site_id: site, category: 6, reward: null }, inReceipt(tx, index));
it("tells an attack that clears its site as one row, the clear, in every Feed lens, as a history read orders them", () => {
  // Newest on the chain first: the battle is written after the payout in the attack's transaction (dev, 20 of 20).
  const stories = [attack("attack", 31, "0xA1"), payout("clear", 31, "0x0a1")];
  for (const lens of ["all", "important", "mine"] as const) expect(feedIds(stories, lens)).toEqual(["clear"]);
  expect(ids(stories, "all")).toEqual(["clear"]);
});

it("keeps an attack its own row when it clears nothing: the guard holds, the army is lost, or another army clears", () => {
  const held = attack("held", 31, "0xb1", 2, "held");
  // Another site's clear in the same transaction (a batch), and the same site's clear in a later one.
  const elsewhere = payout("elsewhere", 32, "0xb1", 3);
  const later = payout("later", 31, "0xb2");
  expect(feedIds([held, elsewhere], "all")).toEqual(["held", "elsewhere"]);
  expect(feedIds([later, held], "all")).toEqual(["later", "held"]);
  expect(feedIds([held], "important")).toEqual(["held"]);
});

it("keeps a lost or held attack on a site its own row when another army clears that site in the same batch", () => {
  // Newest first, as history reads them: in one receipt army A falls to site 31's guard (or the guard holds), then the
  // clear's payout, then the battle in which army B beat the guard.
  for (const outcome of ["lost", "held"] as const) {
    const first = attack(outcome, 31, "0xa1", 1, outcome);
    const clear = payout("clear", 31, "0xa1", 2);
    const won = attack("won", 31, "0xa1", 3);
    for (const lens of ["all", "important", "mine"] as const)
      expect(feedIds([won, clear, first], lens)).toEqual(["clear", outcome]);
    expect(ids([won, clear, first], "all")).toEqual(["clear", outcome]);
  }
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
