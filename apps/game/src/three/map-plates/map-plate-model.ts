import type { FrontierSpecies } from "../structures/frontier-beast";
import { beastMeaning, mineMeaning, structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import { NEUTRAL_OWNER_NAME, StructureType, structureName, frontierSiteName, formatExact } from "@bibliothecadao/types";

import type { ArmyData, StructureInfo } from "../types";

/**
 * How the viewer stands to a thing's owner. It sets the label's side colour (map-plates.css: nobody's is drawn as an
 * enemy's) and, still four ways, which label yields when they crowd (`RELATION_PRIORITY`, map-plate-layer).
 */
export type PlateRelation = "own" | "ally" | "enemy" | "neutral";

/** A troop stack: a guard slot, or an army's troops. Its painting is its type and tier (`knight-t2`). */
export interface PlateTroops {
  type: "crossbowman" | "knight" | "paladin";
  tier: 1 | 2 | 3;
  count: number;
  beast?: FrontierSpecies;
  /** A guard slot's stamina, now and at most, when it is known: a structure's plate, opened, draws it. */
  stamina?: { current: number; max: number };
}

/** An army's plate: its owner over its troops and stamina; opened, the realm it comes from. */
export interface ArmyPlate {
  kind: "army";
  relation: PlateRelation;
  owner: string;
  homeName: string;
  troops: PlateTroops;
  /** Its stamina now and at most; absent when it is not known. */
  stamina?: { current: number; max: number };
  /** It fought and is on its battle cooldown: the map keeps its label in view (`keep`, map-plate-layout). */
  inBattle?: boolean;
}

/**
 * A structure's plate: whose it is, its name and its guard; for a camp or a rift, its lore name and guard. Opened: its
 * guard slots, the troops on their way to it, and for a camp or a rift its owner, its kind and what it holds.
 */
export interface StructurePlate {
  kind: "structure";
  relation: PlateRelation;
  /** Whose it is; empty for a cleared Frontier site, which nobody holds once its guard falls. */
  owner: string;
  /** The standing guard species, shown as the title above its strength. */
  beast?: string;
  /** A realm's or a hyperstructure's own name; else its kind's ("Camp", "Rift"). */
  name: string;
  /** Whether `name` is the place's own, set as a title, rather than its kind's. */
  named: boolean;
  /** A site's name, as its holder and every list read it (siteDisplayName); absent for a realm or a Hyperstructure. */
  place?: string;
  /** What taking it gives, said in words: "1,200 Essence", "50 Labor". */
  reward?: string;
  /** The same as an amount of a unit, for a mark that shows it (the lab's icon study). */
  holding?: PlateReward;
  /**
   * Guard slots in slot order; empty when it stands undefended. Null where the game grants no guard slots and it holds
   * none (a Frontier realm: nobody can attack it), so its plate has no guard row.
   */
  guards: PlateTroops[] | null;
  /** Troops on their way to it (the player's own reinforcements), soonest first, at most three. */
  arrivals: { troops: PlateTroops; secondsLeft: number }[];
  /** Its guard fought and is on its battle cooldown: the map keeps its label in view (`keep`, map-plate-layout). */
  inBattle?: boolean;
  /** Its kind's painting, drawn only as the pin of a plate with no room. */
  icon: IconMeaning;
}

/**
 * The guards a structure has to tell its plate: none where the game grants no guard slots and it holds none (a Frontier
 * realm, which nobody can attack), so its plate has no guard row; else its guards, empty when it stands undefended.
 */
export const guardsToTell = <T>(guards: T[], gameHasGuardSlots: boolean): T[] | undefined =>
  guards.length > 0 || gameHasGuardSlots ? guards : undefined;

/** What taking a camp or a rift gives: an amount of a unit ("Essence", "Labor"). */
export interface PlateReward {
  amount: number;
  unit: string;
}

export type MapPlate = ArmyPlate | StructurePlate;

/**
 * An owner as the manager names it, through the one name rule (readPlayerName); nobody's thing is the neutral side's.
 * The plate never makes a player's name.
 */
const ownerOf = (owner: { address: bigint; ownerName: string }) =>
  owner.address === 0n ? NEUTRAL_OWNER_NAME : owner.ownerName.trim();

const relationOf = (thing: { isMine: boolean; isAlly?: boolean; owner: { address: bigint } }): PlateRelation =>
  thing.isMine ? "own" : thing.isAlly ? "ally" : thing.owner.address === 0n ? "neutral" : "enemy";

const troopType = (category: string | null | undefined): PlateTroops["type"] => {
  switch (category) {
    case "Crossbowman":
      return "crossbowman";
    case "Paladin":
      return "paladin";
    default:
      return "knight";
  }
};

const tierOf = (tier: number | string): PlateTroops["tier"] => {
  const value = typeof tier === "number" ? tier : Number(tier.replace(/^T/, ""));
  return value === 3 ? 3 : value === 2 ? 2 : 1;
};

/** A named structure's kinds: a realm and a hyperstructure carry their own names; the rest are named by their kind. */
const NAMED: ReadonlySet<StructureType> = new Set([StructureType.Realm, StructureType.Hyperstructure]);

export const buildStructurePlate = (
  structure: Pick<
    StructureInfo,
    | "entityId"
    | "structureName"
    | "structureType"
    | "mineKind"
    | "isMine"
    | "isAlly"
    | "owner"
    | "clearedSite"
    | "guardArmies"
    | "incomingTroopArrivals"
    | "frontierBeast"
    | "battleTimerLeft"
  >,
  nowSeconds = 0,
  reward?: PlateReward,
): StructurePlate => {
  const named = NAMED.has(structure.structureType) && structure.structureName.trim().length > 0;
  const guards =
    structure.guardArmies
      ?.filter((guard) => guard.count > 0)
      .toSorted((a, b) => a.slot - b.slot)
      .map((guard) => ({
        type: troopType(guard.category),
        tier: tierOf(guard.tier),
        count: guard.count,
        ...(structure.frontierBeast ? { beast: structure.frontierBeast.beast } : {}),
        ...(guard.stamina && guard.stamina.max > 0 ? { stamina: guard.stamina } : {}),
      })) ?? null;
  return {
    kind: "structure",
    relation: relationOf(structure),
    owner: structure.clearedSite ? "" : ownerOf(structure.owner),
    beast: structure.frontierBeast?.name,
    name: structure.clearedSite
      ? `${frontierSiteName(structure.structureType)} · Cleared`
      : named
        ? structure.structureName.trim()
        : structure.frontierBeast
          ? frontierSiteName(structure.structureType)
          : structureName(structure.structureType, structure.mineKind ?? undefined),
    named,
    // A site's name as its holder and every list read it (siteDisplayName, through the manager): the plate never makes one.
    place: named ? undefined : structure.structureName.trim() || undefined,
    reward: reward && reward.amount > 0 ? `${formatExact(reward.amount)} ${reward.unit}` : undefined,
    holding: reward && reward.amount > 0 ? reward : undefined,
    icon: structure.clearedSite
      ? "flag"
      : structure.frontierBeast
        ? beastMeaning(structure.frontierBeast.beast)
        : structure.structureType === StructureType.Mine && structure.mineKind !== undefined
          ? mineMeaning(structure.mineKind)
          : structureMeaning(structure.structureType),
    guards: structure.clearedSite ? null : guards,
    ...(inBattle(structure.battleTimerLeft) ? { inBattle: true } : {}),
    arrivals: (structure.incomingTroopArrivals ?? [])
      .map((arrival) => ({
        troops: { type: troopType(arrival.troopType), tier: tierOf(arrival.troopTier), count: arrival.count },
        secondsLeft: Math.max(0, Number(arrival.arrivesAt) - nowSeconds),
      }))
      .toSorted((a, b) => a.secondsLeft - b.secondsLeft)
      .slice(0, 3),
  };
};

export const buildArmyPlate = (
  army: Pick<
    ArmyData,
    | "entityId"
    | "isMine"
    | "owner"
    | "category"
    | "tier"
    | "troopCount"
    | "currentStamina"
    | "maxStamina"
    | "battleTimerLeft"
  > & { isAlly?: boolean },
  homeName: string,
): ArmyPlate => ({
  kind: "army",
  relation: relationOf(army),
  owner: ownerOf(army.owner),
  homeName,
  troops: { type: troopType(army.category), tier: tierOf(army.tier), count: army.troopCount },
  stamina:
    army.currentStamina === undefined || army.maxStamina <= 0
      ? undefined
      : { current: Math.max(0, Math.min(army.maxStamina, army.currentStamina)), max: army.maxStamina },
  ...(inBattle(army.battleTimerLeft) ? { inBattle: true } : {}),
});

/**
 * Its troops fought and are still on their battle cooldown (the time its manager keeps left on it): it is under attack,
 * or attacking.
 */
const inBattle = (battleTimerLeft: number | undefined): boolean => (battleTimerLeft ?? 0) > 0;

/**
 * Guard slots in the order an attacker meets them: the contract attacks the highest occupied slot first, slot zero last
 * (`GuardState::next`, contracts/l3/world-native/src/logic/guards.cairo). Slots come in slot order, empty ones left out.
 */
export const attackOrder = (guards: readonly PlateTroops[]): PlateTroops[] => [...guards].reverse();
