import type { ProcessedStoryEvent, StoryRead } from "@/hooks/store/use-story-events-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { logicalStoryIdentity } from "@bibliothecadao/notifications";

/**
 * The two lenses on the game's stories, one meaning in every mode and on every surface (Blitz's Events and Log,
 * Frontier's Feed): Important, what the player must not miss (the Feed's Mine: a Frontier game has no Hyperstructure, so
 * it holds only the player's own); All, the world's history.
 */
export type EventsFilter = "important" | "all";

/** Whether a structure is a Hyperstructure, as the game's facts hold it: a capture of one is everyone's news. */
type IsHyperstructure = (structureId: number) => boolean;

export const involvesPlayer = (event: ProcessedStoryEvent, address: string | null): boolean =>
  event.participants.some((owner) => feltEquals(owner, address));

/** One identity per action, however many stories tell it (a battle's two sides, a building placed and paid for). */
export const storyActionIdentity = (event: ProcessedStoryEvent): string =>
  logicalStoryIdentity(event.event_id, event.story, event, event.storyPayload);

/**
 * Each action once, at its first (newest) story: a list of stories never tells one action twice. A fight its outcome
 * concludes (a site's payout, a capture) is that outcome's action, told by the outcome alone.
 */
export const oneStoryPerAction = (stories: readonly ProcessedStoryEvent[]): ProcessedStoryEvent[] => {
  const outcomes = stories.filter((event) => concludedTarget(event) !== null);
  const seen = new Set<string>();
  return stories.filter((event) => {
    if (outcomes.some((outcome) => concludes(outcome, event))) return false;
    const identity = storyActionIdentity(event);
    return !seen.has(identity) && seen.add(identity) !== undefined;
  });
};

/** The fight an outcome concludes, when the stories hold it: its site's clear names the attack's cost. */
export const fightConcludedBy = <Story extends ToldStory>(
  outcome: Story,
  stories: readonly Story[],
): Story | undefined => stories.find((event) => concludes(outcome, event));

/** A story as the action rule reads it: its kind, what it carries, its structure and its transaction. */
type ToldStory = Pick<ProcessedStoryEvent, "story" | "storyPayload" | "entity_id" | "tx_hash">;

/**
 * Whether `outcome` concludes `fight`: one transaction, the outcome's structure the one the fight attacked. A won
 * attack's site pays out (Frontier) or its structure changes hands (Blitz) in the attack's own transaction.
 */
const concludes = (outcome: ToldStory, fight: ToldStory): boolean => {
  const target = concludedTarget(outcome);
  return (
    fight.story === "BattleEvent" &&
    target !== null &&
    Number(fight.storyPayload.defender_id) === target &&
    transactionKey(fight.tx_hash) === transactionKey(outcome.tx_hash)
  );
};

/** The structure a story ends a fight for: a payout's site, a capture's structure; null for any other story. */
const concludedTarget = (event: ToldStory): number | null => {
  if (event.story === "SitePayout") return Number(event.storyPayload.site_id);
  if (event.story === "StructureCapturedStory") return event.entity_id;
  return null;
};

/** A transaction's key, the same however its hash is written (case, leading zeros). */
const transactionKey = (hash: string): string => hash.toLowerCase().replace(/^0x0*/, "");

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
 * What a lens shows, newest first, each action once (a fight and the capture it won told by the capture): under All the
 * world's history as Herald holds it, every story; under Important the player's must-not-miss. The strip shows the
 * first three; what the player's own click is doing stays on the control they clicked.
 */
export const selectEventStories = (
  stories: ProcessedStoryEvent[],
  filter: EventsFilter,
  address: string | null,
  isHyperstructure: IsHyperstructure,
): ProcessedStoryEvent[] =>
  filter === "all"
    ? oneStoryPerAction(stories)
    : oneStoryPerAction(
        stories
          .filter((event) => isImportantStory(event, address, isHyperstructure))
          .toSorted((left, right) => right.timestampMs - left.timestampMs),
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

/**
 * Frontier's Feed's three lenses (owner, 27 October: "All / Important (battles but not just mine), then mine"): All,
 * the world's history; Important, the notable stories of anyone; Mine, every story that names the player. Blitz's
 * Events and Log keep their two (EventsFilter).
 */
export type FeedLens = "all" | "important" | "mine";

/**
 * What the Feed's Important holds, from every player: a fight (with a player, a beast or a site's guard), a raid, a
 * capture, a site cleared, and a chest opened. Exploring, raising an army, training, moving troops and building are
 * the routine left to All and Mine.
 */
const NOTABLE_STORIES = [
  "BattleEvent",
  "RaidEvent",
  "StructureCapturedStory",
  "SitePayout",
  "RewardChestOpened",
  "RelicChestOpened",
] as const;

const isNotable = (event: ProcessedStoryEvent) => (NOTABLE_STORIES as readonly string[]).includes(event.story);

/** How many stories each of the Feed's narrower reads holds, newest first. */
const FEED_READ_LIMIT = 100;

/** The history reads a Feed lens needs: the world's newest stories, each notable kind's, or the player's own. */
export const feedReads = (lens: FeedLens, address: string | null): StoryRead[] => {
  if (lens === "all") return [{ limit: WORLD_STORIES }];
  if (lens === "important") return NOTABLE_STORIES.map((story) => ({ limit: FEED_READ_LIMIT, story }));
  return address === null ? [] : [{ limit: FEED_READ_LIMIT, owner: address }];
};

/**
 * What a Feed lens shows, newest first, each action once (a won attack told by the site it cleared or the structure it
 * took): All every story; Important the notable ones; Mine the stories that name the player.
 */
export const selectFeedStories = (
  stories: ProcessedStoryEvent[],
  lens: FeedLens,
  address: string | null,
): ProcessedStoryEvent[] => {
  const newestFirst = (kept: ProcessedStoryEvent[]) =>
    kept.toSorted((left, right) => right.timestampMs - left.timestampMs);
  if (lens === "all") return oneStoryPerAction(stories);
  if (lens === "important") return oneStoryPerAction(newestFirst(stories.filter(isNotable)));
  return oneStoryPerAction(newestFirst(stories.filter((event) => involvesPlayer(event, address))));
};
