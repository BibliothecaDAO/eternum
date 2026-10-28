import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { type IconMeaning, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { attributeMark, type AttributeKey } from "@/ui/features/frontier/army/army-detail";
import { configManager, findGain, siteDisplayName } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  buildingName,
  CHEST_EARNED,
  fightVerdict,
  formatCharge,
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
type FeedReading = ToldReading | OwnWords;

/** A story taken apart: who did it, what they did and to what, what came of it, and what it paid. */
export interface ToldReading {
  /** The player who acted: a fight's attacker, any other story's owner. */
  actor: string;
  /** The act after the name: "explored", "cleared", "attacked". */
  verb: string;
  /** What the act was done to or made: troops, an attribute, a building; a player; or a site, painted by its guard. */
  object?:
    | { name: string; icon?: IconMeaning }
    | { player: string; icon: IconMeaning }
    | { name: string; site: number };
  outcome?: { word: string; tone: "good" | "bad" | "neutral" };
  /** What it paid, as its story's rule writes it: a find under a unit pays nothing to show (findGain). */
  reward?: { amountText: string; icon: IconMeaning; name: string };
}

/**
 * A story this reading does not take apart, in its own words: who did it is its owner, a player; a story no player owns
 * (a season's end) has no one to name.
 */
interface OwnWords {
  actor?: string;
  words: string;
  /** Where the words name the actor, as the story formatter wrote them (`ownerAt`); none where they do not. */
  named?: { at: number; length: number };
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
        object: site && siteObject(site.entity_id),
        reward: paid(payload.resource_type, payload.amount, findGain),
      };
    }
    case "SitePayout": {
      const reward = payload.reward as { resource_type: unknown; amount: unknown } | null;
      return {
        actor,
        verb: "cleared",
        object: siteObject(payload.site_id),
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
        object:
          BigInt(String(defender.player)) === 0n
            ? siteObject(payload.defender_id)
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
        object: {
          name: story.presentation.description ?? "an army",
          icon: troopMeaning({ category: String(payload.category), tier: String(payload.tier) }),
        },
      };
    case "SkillPointSpent":
      return {
        actor,
        verb: "spent a point",
        // The attribute and its tier as the story says them: "Logistics uncommon".
        object: {
          name: story.presentation.title,
          icon: skillPointIcon(payload.choice),
        },
      };
    case "TroopsTransferred":
      return {
        actor,
        verb: "moved",
        object: { name: `${formatCharge(scaledToUnits(BigInt(String(payload.amount ?? 0))))} troops` },
      };
    case "BuildingPaymentStory":
    case "BuildingPlacementStory": {
      const change = story.story === "BuildingPaymentStory" ? "Created" : String(payload.change);
      const verb = BUILDING_CHANGES[change];
      if (!verb) throw new Error(`Unknown building change ${change}`);
      return { actor, verb, object: { name: buildingName(Number(payload.category), true) } };
    }
    default:
      return {
        actor: playerOwner(story.owner),
        words: story.presentation.title,
        named: ownerNamed(story.presentation),
      };
  }
};

/** A fight is its attacker's act; any other story its owner's. */
const actorOf = (story: ProcessedStoryEvent): string =>
  story.story === "BattleEvent"
    ? String((story.storyPayload.attacker as Record<string, unknown>).player)
    : String(story.owner ?? "0x0");

/** A story's owner when a player owns it: an address other than zero. */
const playerOwner = (owner: unknown): string | undefined => {
  const address = String(owner ?? "");
  return address.startsWith("0x") && BigInt(address) !== 0n ? address : undefined;
};

/** Where a story's words name its owner, as its formatter marked it. */
const ownerNamed = ({ ownerAt, owner }: ProcessedStoryEvent["presentation"]): OwnWords["named"] =>
  ownerAt === null || ownerAt === undefined || !owner ? undefined : { at: ownerAt, length: owner.length };

/** What a story paid, written by its rule; none when the rule writes nothing. */
const paid = (
  resource: unknown,
  amount: unknown,
  rule: (units: number | undefined) => string | null,
): ToldReading["reward"] => {
  const written = rule(scaledToUnits(BigInt(String(amount ?? 0))));
  if (written === null) return undefined;
  const id = Number(resource) as ResourcesIds;
  return { amountText: written, icon: resourceMeaning(id), name: resourceName(id) };
};

/** The site the revealed tile holds, as the game's facts keep it. */
const siteAt = (coord: unknown, store: NativeFactStore) => {
  const place = coord as { x: unknown; y: unknown; alt: unknown } | undefined;
  if (!place) return undefined;
  return [...store.inGame("ExpeditionSite", configManager.getActiveGameId())].find(
    (site) => site.col === Number(place.x) && site.row === Number(place.y) && site.alt === Boolean(place.alt),
  );
};

/** A site by its one name; the line paints it by its guard (useSiteBeastMeaning). */
const siteObject = (entityId: unknown): ToldReading["object"] => {
  const id = Number(entityId);
  return { name: siteDisplayName(id), site: id };
};

const skillPointIcon = (choice: unknown): IconMeaning => {
  const name = typeof choice === "string" ? choice : Object.keys((choice ?? {}) as object)[0];
  return name === "Stamina" ? "stamina" : attributeMark(String(name).toLowerCase() as AttributeKey);
};
