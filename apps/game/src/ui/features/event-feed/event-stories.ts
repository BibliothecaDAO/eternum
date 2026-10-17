import type { ProcessedStoryEvent, StoryRead } from "@/hooks/store/use-story-events-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { logicalStoryIdentity, storyRecipients } from "@bibliothecadao/notifications";

/**
 * What Events and the Log show, the player's one choice for both: the important events (the default), everything about
 * the player, or everything Events holds.
 */
export type EventsFilter = "important" | "mine" | "all";

/** Whether a structure is a Hyperstructure, as the game's facts hold it: a capture of one is everyone's news. */
type IsHyperstructure = (structureId: number) => boolean;

export const involvesPlayer = (event: ProcessedStoryEvent, address: string | null): boolean =>
  storyRecipients(event.story, event.owner, event.storyPayload).some((owner) => feltEquals(owner, address));

/** One identity per action, however many stories tell it (a battle's two sides, a building placed and paid for). */
export const storyActionIdentity = (event: ProcessedStoryEvent): string =>
  logicalStoryIdentity(event.event_id, event.story, event, event.storyPayload);

/** Each action once, at its first (newest) story: a list of stories never tells one action twice. */
export const oneStoryPerAction = (stories: ProcessedStoryEvent[]): ProcessedStoryEvent[] => {
  const seen = new Set<string>();
  return stories.filter((event) => {
    const identity = storyActionIdentity(event);
    return !seen.has(identity) && seen.add(identity) !== undefined;
  });
};

/** The world's fights, which Events tells whoever fought them: every battle, raid and capture. */
const FIGHT_STORIES = ["BattleEvent", "RaidEvent", "StructureCapturedStory"];

/**
 * The stories of the player's own realms and actions, which Events tells when they name the player: a realm founded, a
 * spire found, a building placed or paid for, a level gained, a delivery, a crate opened, an explore's find, an army
 * raised, a caravan sent.
 */
const PLAYER_STORIES = [
  "RealmCreatedStory",
  "SpireDiscovered",
  "BuildingPlacementStory",
  "StructureLevelUpStory",
  "ResourceReceiveArrivalStory",
  "RelicChestOpened",
  "BuildingPaymentStory",
  "ExplorationReward",
  "ExplorerCreateStory",
  "ResourceTransferStory",
];

/**
 * What Events holds, all from the game's history: the world's fights and the stories of the player's own realms and
 * actions. Routine moves, production and point accrual stay in the world history.
 */
const isEventsStory = (event: ProcessedStoryEvent, address: string | null): boolean =>
  FIGHT_STORIES.includes(event.story) || (PLAYER_STORIES.includes(event.story) && involvesPlayer(event, address));

/** The stories that are important when they name the player: a fight, a raid, a capture, a crate opened. */
const IMPORTANT_STORIES = ["BattleEvent", "RaidEvent", "StructureCapturedStory", "RelicChestOpened"];

/**
 * Whether a story is important, the default view of Events and the Log: what the player must not miss. Their fights (an
 * army lost, a realm under attack), raids and captures, by them or of theirs, the crates they opened, and a
 * Hyperstructure taken by anyone, the race for points.
 */
const isImportantStory = (event: ProcessedStoryEvent, address: string | null, isHyperstructure: IsHyperstructure) =>
  (IMPORTANT_STORIES.includes(event.story) && involvesPlayer(event, address)) ||
  (event.story === "StructureCapturedStory" && event.entity_id !== null && isHyperstructure(event.entity_id));

/** Whether a story shows under the filter: all of Events' under All, the player's under Mine, the important under Important. */
const matchesEventsFilter = (
  event: ProcessedStoryEvent,
  filter: EventsFilter,
  address: string | null,
  isHyperstructure: IsHyperstructure,
): boolean => {
  if (filter === "all") return true;
  return filter === "mine" ? involvesPlayer(event, address) : isImportantStory(event, address, isHyperstructure);
};

/**
 * One row per transaction: a capture tells it, being the outcome of the fight that won it, wherever the chain wrote it
 * among the transaction's stories; any other transaction is told by its newest story.
 */
const onePerTransaction = (stories: ProcessedStoryEvent[]): ProcessedStoryEvent[] => {
  const told = new Map<string, ProcessedStoryEvent>();
  for (const event of stories) {
    const key = transactionKey(event.tx_hash);
    const held = told.get(key);
    if (!held || (event.story === "StructureCapturedStory" && held.story !== "StructureCapturedStory")) {
      told.set(key, event);
    }
  }
  return [...told.values()];
};

/** A transaction's key, the same however its hash is written (case, leading zeros). */
const transactionKey = (hash: string): string => hash.toLowerCase().replace(/^0x0*/, "");

/**
 * What Events and the Log show: the game's stories alone, the one record of what happened, each action once, newest
 * first, through the player's filter. The strip shows the first three; what the player's own click is doing stays on
 * the control they clicked.
 */
export const selectEventStories = (
  stories: ProcessedStoryEvent[],
  filter: EventsFilter,
  address: string | null,
  isHyperstructure: IsHyperstructure,
): ProcessedStoryEvent[] =>
  onePerTransaction(
    oneStoryPerAction(
      stories
        .filter((event) => isEventsStory(event, address))
        .toSorted((left, right) => right.timestampMs - left.timestampMs),
    ),
  ).filter((event) => matchesEventsFilter(event, filter, address, isHyperstructure));

/** How many stories each of Events' reads holds, newest first. */
const READ_LIMIT = 100;

/**
 * The history reads the filter needs, each holding only stories the filter shows, so what it leaves out never takes a
 * read's room: under Important the player's fights, raids, captures and crates and each Hyperstructure's captures; under
 * Mine every Events story naming the player; under All the world's fights and the player's own stories.
 */
export const eventsReads = (filter: EventsFilter, address: string | null, hyperstructures: number[]): StoryRead[] => {
  const players = (stories: string[]) =>
    address === null ? [] : stories.map((story) => ({ limit: READ_LIMIT, story, owner: address }));
  if (filter === "important") {
    return [
      ...players(IMPORTANT_STORIES),
      ...hyperstructures.map((entityId) => ({ limit: READ_LIMIT, story: "StructureCapturedStory", entityId })),
    ];
  }
  if (filter === "mine") return players([...FIGHT_STORIES, ...PLAYER_STORIES]);
  return [...FIGHT_STORIES.map((story) => ({ limit: READ_LIMIT, story })), ...players(PLAYER_STORIES)];
};
