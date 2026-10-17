import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { includesStoryNotification, logicalStoryIdentity, storyRecipients } from "@bibliothecadao/notifications";

/**
 * What Events and the Log show, the player's one choice for both: the important events (the default), everything about
 * the player, or everything Events holds.
 */
export type EventsFilter = "important" | "mine" | "all";

/** Whether a structure is a Hyperstructure, as the game's facts hold it: a capture of one is everyone's news. */
export type IsHyperstructure = (structureId: number) => boolean;

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

/**
 * The stories of the player's own actions that their notification level files as routine, which Events tells all the
 * same: a building paid for, an explore's find, an army raised, a caravan sent.
 */
const PLAYER_ACTION_STORIES = new Set([
  "BuildingPaymentStory",
  "ExplorationReward",
  "ExplorerCreateStory",
  "ResourceTransferStory",
]);

/**
 * What Events holds, all from the game's history: every battle, raid and capture, and the stories of the player's own
 * realms and actions. Routine moves, production and point accrual stay in the world history.
 */
const isEventsStory = (event: ProcessedStoryEvent, address: string | null): boolean =>
  includesStoryNotification("important", event.story) ||
  ((includesStoryNotification("standard", event.story) || PLAYER_ACTION_STORIES.has(event.story)) &&
    involvesPlayer(event, address));

/** The stories that are important when they name the player: a fight, a raid, a capture, a crate opened. */
const IMPORTANT_STORIES = new Set(["BattleEvent", "RaidEvent", "StructureCapturedStory", "RelicChestOpened"]);

/**
 * Whether a story is important, the default view of Events and the Log: what the player must not miss. Their fights (an
 * army lost, a realm under attack), raids and captures, by them or of theirs, the crates they opened, and a
 * Hyperstructure taken by anyone, the race for points.
 */
const isImportantStory = (event: ProcessedStoryEvent, address: string | null, isHyperstructure: IsHyperstructure) =>
  (IMPORTANT_STORIES.has(event.story) && involvesPlayer(event, address)) ||
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
