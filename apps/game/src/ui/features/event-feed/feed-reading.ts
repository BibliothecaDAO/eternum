import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { beastMeaning, structureMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { type IconMeaning, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { attributeMark, type AttributeKey } from "@/ui/features/frontier/army/army-detail";
import { configManager, findGain, readFrontierBeast, siteDisplayName } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  buildingName,
  CHEST_EARNED,
  fightVerdict,
  formatGain,
  resourceName,
  type ResourcesIds,
  scaledToUnits,
  StructureType,
  VERDICT_WORDS,
} from "@bibliothecadao/types";

/**
 * A Feed row as Frontier's Feed draws it (owner, 26 October 2026: "in the feed I wanna see the player names even for
 * exploring"; option A): who did it, what they did and to what, what came of it, and what it paid.
 */
export interface FeedReading {
  /** The player who acted: a fight's attacker, any other story's owner. */
  actor: string;
  /** The act after the name: "explored", "cleared", "attacked". Empty for a story told in its own words. */
  verb: string;
  /** The act's painting, at the row's head. */
  act: IconMeaning;
  /** What the act was done to or made: a site with its guard's painting, troops, an attribute, a building; or a player. */
  object?: { name: string; icon?: IconMeaning } | { player: string; icon: IconMeaning };
  outcome?: { word: string; tone: "good" | "bad" | "neutral" };
  /** What it paid, as its story's rule writes it: a find under a unit pays nothing to show (findGain). */
  reward?: { amount: string; icon: IconMeaning; name: string };
  /** A story this reading does not take apart: its own words stand after the name. */
  words?: string;
}

const BUILDING_CHANGES: Record<string, string> = {
  Created: "built",
  Destroyed: "demolished",
  Paused: "paused",
  Resumed: "resumed",
};

/** One story, read for the Feed from the same payload and facts its words are written from. */
export const readFeedStory = (story: ProcessedStoryEvent, store: NativeFactStore): FeedReading => {
  const payload = story.storyPayload;
  const actor = actorOf(story);
  switch (story.story) {
    case "ExplorationReward": {
      const site = siteAt(payload.coord, store);
      return {
        actor,
        verb: site ? "found" : "explored",
        act: "explore",
        object: site && siteObject(site.entity_id, store),
        reward: paid(payload.resource_type, payload.amount, findGain),
      };
    }
    case "SitePayout": {
      const reward = payload.reward as { resource_type: unknown; amount: unknown } | null;
      return {
        actor,
        verb: "cleared",
        act: "flag",
        object: siteObject(payload.site_id, store),
        outcome: Number(payload.category) === StructureType.Ruin ? { word: CHEST_EARNED, tone: "good" } : undefined,
        reward: reward ? paid(reward.resource_type, reward.amount, formatGain) : undefined,
      };
    }
    case "BattleEvent": {
      const attacker = payload.attacker as Record<string, unknown>;
      const defender = payload.defender as Record<string, unknown>;
      const verdict = fightVerdict({ army: BigInt(String(attacker.after)), guard: BigInt(String(defender.after)) });
      return {
        actor,
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
        actor,
        verb: "raised",
        act: "deploy",
        object: {
          name: story.presentation.description ?? "an army",
          icon: troopMeaning({ category: String(payload.category), tier: String(payload.tier) }),
        },
      };
    case "TierBought":
      return {
        actor,
        verb: "trained",
        act: "research",
        // The attribute and its tier as the story says them: "Logistics uncommon".
        object: {
          name: story.presentation.title,
          icon: attributeMark(String(payload.attribute).toLowerCase() as AttributeKey),
        },
      };
    case "BuildingPaymentStory":
    case "BuildingPlacementStory": {
      const change = story.story === "BuildingPaymentStory" ? "Created" : String(payload.change);
      const verb = BUILDING_CHANGES[change];
      if (!verb) throw new Error(`Unknown building change ${change}`);
      return { actor, verb, act: "build", object: { name: buildingName(Number(payload.category), true) } };
    }
    default:
      return { actor, verb: "", act: "chronicles", words: story.presentation.title };
  }
};

/** A fight is its attacker's act; any other story its owner's. */
const actorOf = (story: ProcessedStoryEvent): string =>
  story.story === "BattleEvent"
    ? String((story.storyPayload.attacker as Record<string, unknown>).player)
    : String(story.owner ?? "0x0");

/** What a story paid, written by its rule; none when the rule writes nothing. */
const paid = (
  resource: unknown,
  amount: unknown,
  rule: (units: number | undefined) => string | null,
): FeedReading["reward"] => {
  const written = rule(scaledToUnits(BigInt(String(amount ?? 0))));
  if (written === null) return undefined;
  const id = Number(resource) as ResourcesIds;
  return { amount: written, icon: resourceMeaning(id), name: resourceName(id) };
};

/** The site the revealed tile holds, as the game's facts keep it. */
const siteAt = (coord: unknown, store: NativeFactStore) => {
  const place = coord as { x: unknown; y: unknown; alt: unknown } | undefined;
  if (!place) return undefined;
  return [...store.inGame("ExpeditionSite", configManager.getActiveGameId())].find(
    (site) => site.col === Number(place.x) && site.row === Number(place.y) && site.alt === Boolean(place.alt),
  );
};

/** A site by its one name, with its guard's painting where a beast guards it, else its kind's. */
const siteObject = (entityId: unknown, store: NativeFactStore): FeedReading["object"] => {
  const id = Number(entityId);
  const gameId = configManager.getActiveGameId();
  const site = store.get("ExpeditionSite", { game_id: gameId, entity_id: BigInt(id) });
  const beast = readFrontierBeast(store, gameId, id);
  return {
    name: siteDisplayName(id),
    icon: beast ? beastMeaning(beast.beast) : site ? structureMeaning(site.category) : "beasts",
  };
};
