import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { beastMeaning, structureMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { type IconMeaning, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { configManager, readFrontierBeast, siteDisplayName } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  buildingName,
  CHEST_EARNED,
  fightVerdict,
  formatCharge,
  resourceName,
  type ResourcesIds,
  scaledToUnits,
  StructureType,
  VERDICT_WORDS,
} from "@bibliothecadao/types";

/** What a row shows, whatever its layout: who did what, to what, with what outcome and reward. */
export interface FeedReading {
  id: string;
  /** Chain seconds. */
  at: number;
  /** The player who acted: the story's owner, a fight's attacker. */
  actor: string;
  /** The verb as a sentence says it after the name: "explored", "cleared", "attacked". */
  verb: string;
  /** The act's painting, the kill feed's middle. */
  act: IconMeaning;
  /**
   * What the act was done to or made: a site and its guard's painting, an army raised, an attribute trained; or a
   * player, named as every player is named (usePlayerNames).
   */
  object?: { name: string; icon?: IconMeaning } | { player: string; icon: IconMeaning };
  outcome?: { word: string; tone: "good" | "bad" | "neutral" };
  /** What it paid, whole; absent under one (the owner, 26 Oct: "if the exploration reward is <1 dont display it"). */
  reward?: { amount: string; icon: IconMeaning; name: string };
  /** A kind this draft does not take apart yet: the story's own words stand after the name. */
  words?: string;
}

const ATTRIBUTE_MARKS: Record<string, IconMeaning> = {
  Battle: "order-rage",
  Logistics: "order-skill",
  Scouting: "order-detection",
  Homecoming: "order-enlightenment",
};
const TIERS = ["", "common", "uncommon", "rare", "epic", "legendary"];
/** What each change a placement story carries reads as. */
const BUILDING_CHANGES: Record<string, string> = {
  Created: "built",
  Destroyed: "demolished",
  Paused: "paused",
  Resumed: "resumed",
};

/** One story, read for the Feed: the same payload and facts the story's words read, taken apart. */
export const readFeedStory = (story: ProcessedStoryEvent, store: NativeFactStore): FeedReading => {
  const payload = story.storyPayload;
  const base = { id: story.id, at: story.timestampMs / 1000, actor: actorOf(story) };
  switch (story.story) {
    case "ExplorationReward": {
      const site = siteAt(payload.coord, store);
      return {
        ...base,
        verb: site ? "found" : "explored",
        act: "explore",
        object: site && siteObject(site.entity_id, store),
        reward: rewardOf(payload.resource_type, payload.amount),
      };
    }
    case "SitePayout": {
      const reward = payload.reward as { resource_type: unknown; amount: unknown } | null;
      const ruin = Number(payload.category) === StructureType.Ruin;
      return {
        ...base,
        verb: "cleared",
        act: "flag",
        object: siteObject(payload.site_id, store),
        outcome: ruin ? { word: CHEST_EARNED, tone: "good" } : undefined,
        reward: reward ? rewardOf(reward.resource_type, reward.amount) : undefined,
      };
    }
    case "BattleEvent": {
      const attacker = payload.attacker as Record<string, unknown>;
      const defender = payload.defender as Record<string, unknown>;
      const verdict = fightVerdict({ army: BigInt(String(attacker.after)), guard: BigInt(String(defender.after)) });
      return {
        ...base,
        verb: "attacked",
        act: "attack",
        object:
          BigInt(String(defender.player)) === 0n
            ? siteObject(payload.defender_id, store)
            : { player: String(defender.player), icon: "military" },
        outcome: {
          word: VERDICT_WORDS[verdict],
          tone: verdict === "victory" ? "good" : verdict === "army-lost" ? "bad" : "neutral",
        },
      };
    }
    case "ExplorerCreateStory":
      return {
        ...base,
        verb: "raised an army",
        act: "deploy",
        object: {
          name: `${formatCharge(scaledToUnits(BigInt(String(payload.amount))))} ${String(payload.category)}s`,
          icon: troopMeaning({ category: String(payload.category), tier: String(payload.tier) }),
        },
      };
    case "TierBought": {
      const attribute = String(payload.attribute);
      return {
        ...base,
        verb: "trained",
        act: "research",
        object: {
          name: `${attribute} ${TIERS[Number(payload.tier)] ?? ""}`.trim(),
          icon: ATTRIBUTE_MARKS[attribute] ?? "research",
        },
      };
    }
    case "BuildingPaymentStory":
    case "BuildingPlacementStory": {
      const change = story.story === "BuildingPaymentStory" ? "Created" : String(payload.change);
      const verb = BUILDING_CHANGES[change];
      if (!verb) throw new Error(`Unknown building change ${change}`);
      return {
        ...base,
        verb,
        act: "build",
        object: { name: buildingName(Number(payload.category), true) },
      };
    }
    default:
      return { ...base, verb: "", act: "chronicles", words: story.presentation.title };
  }
};

/** A fight is its attacker's act; any other story its owner's. */
const actorOf = (story: ProcessedStoryEvent): string =>
  story.story === "BattleEvent"
    ? String((story.storyPayload.attacker as Record<string, unknown>).player)
    : String(story.owner ?? "0x0");

/** The reward, whole; none under one unit, or none at all. */
const rewardOf = (resource: unknown, amount: unknown): FeedReading["reward"] => {
  const units = scaledToUnits(BigInt(String(amount ?? 0)));
  if (units < 1) return undefined;
  const id = Number(resource) as ResourcesIds;
  return { amount: `+${formatCharge(units)}`, icon: resourceMeaning(id), name: resourceName(id) };
};

/** The site the revealed tile holds, as the game's facts keep it. */
const siteAt = (coord: unknown, store: NativeFactStore) => {
  const place = coord as { x: unknown; y: unknown; alt: unknown } | undefined;
  if (!place) return undefined;
  return [...store.inGame("ExpeditionSite", configManager.getActiveGameId())].find(
    (site) => site.col === Number(place.x) && site.row === Number(place.y) && site.alt === Boolean(place.alt),
  );
};

/** A site by its one name, and its guard's painting where a beast guards it, else its kind's. */
const siteObject = (entityId: unknown, store: NativeFactStore): FeedReading["object"] => {
  const id = Number(entityId);
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: BigInt(id) });
  const beast = readFrontierBeast(store, configManager.getActiveGameId(), id);
  return {
    name: siteDisplayName(id),
    icon: beast ? beastMeaning(beast.beast) : site ? structureMeaning(site.category) : "beasts",
  };
};

/** A run: one player's stories in a row, none more than ten minutes after the last, newest first. */
export interface FeedRun {
  actor: string;
  readings: FeedReading[];
  /** Its explorations as one line: how many, and what they paid by resource, whole. */
  explored: { count: number; rewards: NonNullable<FeedReading["reward"]>[] };
  /** Everything else, each on its own line. */
  acts: FeedReading[];
}

const RUN_GAP_SECONDS = 600;

/** The feed's readings (newest first) as runs, each run's explorations summed in one line. */
export const feedRuns = (readings: readonly FeedReading[], stories: readonly ProcessedStoryEvent[]): FeedRun[] => {
  const runs: { actor: string; readings: FeedReading[] }[] = [];
  for (const reading of readings) {
    const run = runs.at(-1);
    const last = run?.readings.at(-1);
    if (run && last && run.actor === reading.actor && last.at - reading.at <= RUN_GAP_SECONDS)
      run.readings.push(reading);
    else runs.push({ actor: reading.actor, readings: [reading] });
  }
  const storyOf = new Map(stories.map((story) => [story.id, story]));
  return runs.map((run) => {
    const explores = run.readings.filter((reading) => reading.verb === "explored");
    return {
      ...run,
      explored: { count: explores.length, rewards: summedRewards(explores.map((reading) => storyOf.get(reading.id)!)) },
      acts: run.readings.filter((reading) => reading.verb !== "explored"),
    };
  });
};

/** What explorations paid, summed exactly by resource and then written whole; a sum under one is left out. */
const summedRewards = (stories: readonly ProcessedStoryEvent[]): NonNullable<FeedReading["reward"]>[] => {
  const sums = new Map<number, bigint>();
  for (const { storyPayload } of stories) {
    const resource = Number(storyPayload.resource_type);
    sums.set(resource, (sums.get(resource) ?? 0n) + BigInt(String(storyPayload.amount ?? 0)));
  }
  return [...sums].flatMap(([resource, amount]) => {
    const reward = rewardOf(resource, amount);
    return reward ? [reward] : [];
  });
};
