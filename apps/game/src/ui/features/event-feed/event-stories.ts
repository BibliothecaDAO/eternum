import type { ProcessedStoryEvent, StoryRead } from "@/hooks/store/use-story-events-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { logicalStoryIdentity, storyRecipients } from "@bibliothecadao/notifications";

/**
 * The two lenses on the game's stories, one meaning in every mode and on every surface (Blitz's Events and Log,
 * Frontier's Feed): Important, what the player must not miss; All, the world's history.
 */
export type EventsFilter = "important" | "all";

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

/** The stories that are important when they name the player: a fight, a raid, a capture, a crate opened, a relic used. */
const IMPORTANT_STORIES = [
  "BattleEvent",
  "RaidEvent",
  "StructureCapturedStory",
  "RelicChestOpened",
  "RelicActivated",
  "RewardChestOpened",
];

/**
 * Whether a story is important, the default lens of Events and the Log: what the player must not miss. Their fights (an
 * army lost, a realm under attack), raids and captures, by them or of theirs, the crates they opened, and a
 * Hyperstructure taken by anyone, the race for points.
 */
const isImportantStory = (event: ProcessedStoryEvent, address: string | null, isHyperstructure: IsHyperstructure) =>
  (IMPORTANT_STORIES.includes(event.story) && involvesPlayer(event, address)) ||
  (event.story === "StructureCapturedStory" && event.entity_id !== null && isHyperstructure(event.entity_id));

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
 * What a lens shows, newest first, each action once: under All the world's history as Herald holds it, every story;
 * under Important the player's must-not-miss, a fight and the capture it won told once, by the capture. The strip shows
 * the first three; what the player's own click is doing stays on the control they clicked.
 */
export const selectEventStories = (
  stories: ProcessedStoryEvent[],
  filter: EventsFilter,
  address: string | null,
  isHyperstructure: IsHyperstructure,
): ProcessedStoryEvent[] =>
  filter === "all"
    ? oneStoryPerAction(stories)
    : onePerTransaction(
        oneStoryPerAction(
          stories
            .filter((event) => isImportantStory(event, address, isHyperstructure))
            .toSorted((left, right) => right.timestampMs - left.timestampMs),
        ),
      );

/** How many stories each Important read holds, newest first. */
const READ_LIMIT = 100;

/** How far back All reads the world's history: its newest stories. */
const WORLD_STORIES = 350;

/**
 * The history reads a lens needs: under All one read of the world's newest stories; under Important the player's
 * fights, raids, captures and crates and each Hyperstructure's captures, each its own read, so what one leaves out never
 * takes another's room.
 */
export const eventsReads = (filter: EventsFilter, address: string | null, hyperstructures: number[]): StoryRead[] => {
  if (filter === "all") return [{ limit: WORLD_STORIES }];
  const players =
    address === null ? [] : IMPORTANT_STORIES.map((story) => ({ limit: READ_LIMIT, story, owner: address }));
  return [
    ...players,
    ...hyperstructures.map((entityId) => ({ limit: READ_LIMIT, story: "StructureCapturedStory", entityId })),
  ];
};
