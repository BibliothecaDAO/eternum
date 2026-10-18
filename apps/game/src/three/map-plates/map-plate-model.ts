import { mineMeaning, structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import { displayPlayerName, getStructureTypeName } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";

import type { ArmyData, StructureInfo } from "../types";
import { siteName } from "./site-name";

/** How the viewer stands to a thing's owner: it colours the plate's side bar and a player's name. */
export type PlateRelation = "own" | "ally" | "enemy" | "neutral";

/** A troop stack: a guard slot, or an army's troops. Its painting is its type and tier (`knight-t2`). */
export interface PlateTroops {
  type: "crossbowman" | "knight" | "paladin";
  tier: 1 | 2 | 3;
  count: number;
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
}

/**
 * A structure's plate: whose it is, its name and its guard; for a camp or a rift, its lore name and guard. Opened: its
 * guard slots, the troops on their way to it, and for a camp or a rift its owner, its kind and what it holds.
 */
export interface StructurePlate {
  kind: "structure";
  relation: PlateRelation;
  owner: string;
  /** A realm's or a hyperstructure's own name; else its kind's ("Camp", "Essence Rift"). */
  name: string;
  /** Whether `name` is the place's own, set as a title, rather than its kind's. */
  named: boolean;
  /** A nameless place's lore name, read off its id (`siteName`); absent for a named one. */
  place?: string;
  /** What taking it gives, said in words: "1,200 Essence", "50 Labor". */
  reward?: string;
  /** Guard slots in slot order; empty when it stands undefended. */
  guards: PlateTroops[];
  /** Troops on their way to it (the player's own reinforcements), soonest first, at most three. */
  arrivals: { troops: PlateTroops; secondsLeft: number }[];
  /** Its kind's painting, drawn only as the pin of a plate with no room. */
  icon: IconMeaning;
}

/** What taking a camp or a rift gives: an amount of a unit ("Essence", "Labor"). */
export interface PlateReward {
  amount: number;
  unit: string;
}

export type MapPlate = ArmyPlate | StructurePlate;

/** An owner as every surface names it: the Vanguard for nobody's thing (`displayPlayerName`). */
const ownerOf = (owner: { address: bigint; ownerName: string }) =>
  displayPlayerName(owner.address.toString(), owner.ownerName.trim() || null);

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
    | "guardArmies"
    | "incomingTroopArrivals"
  >,
  nowSeconds = 0,
  reward?: PlateReward,
): StructurePlate => {
  const named = NAMED.has(structure.structureType) && structure.structureName.trim().length > 0;
  const guards = (structure.guardArmies ?? [])
    .filter((guard) => guard.count > 0)
    .toSorted((a, b) => a.slot - b.slot)
    .map((guard) => ({ type: troopType(guard.category), tier: tierOf(guard.tier), count: guard.count }));
  return {
    kind: "structure",
    relation: relationOf(structure),
    owner: ownerOf(structure.owner),
    name: named
      ? structure.structureName.trim()
      : getStructureTypeName(structure.structureType, structure.mineKind ?? undefined),
    named,
    place: named ? undefined : siteName(Number(structure.entityId)),
    reward: reward && reward.amount > 0 ? `${formatCount(reward.amount)} ${reward.unit}` : undefined,
    icon:
      structure.structureType === StructureType.Mine && structure.mineKind !== undefined
        ? mineMeaning(structure.mineKind)
        : structureMeaning(structure.structureType),
    guards,
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
    "entityId" | "isMine" | "owner" | "category" | "tier" | "troopCount" | "currentStamina" | "maxStamina"
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
});

/**
 * A guard at rest, one number: a single slot as that slot (its troop type, tier and count); several as their total
 * count, their slots left to the opened plate; none, open.
 */
export const restingGuard = (
  guards: readonly PlateTroops[],
): { kind: "slot"; slot: PlateTroops } | { kind: "total"; total: number } | { kind: "open" } => {
  if (guards.length === 0) return { kind: "open" };
  if (guards.length === 1) return { kind: "slot", slot: guards[0] };
  return { kind: "total", total: guards.reduce((sum, slot) => sum + slot.count, 0) };
};

/**
 * Guard slots in the order an attacker meets them: the contract attacks the highest occupied slot first, slot zero last
 * (`GuardState::next`, contracts/l3/world-native/src/logic/guards.cairo). Slots come in slot order, empty ones left out.
 */
export const attackOrder = (guards: readonly PlateTroops[]): PlateTroops[] => [...guards].reverse();

export const formatCount = (count: number) => Math.round(count).toLocaleString("en-US");
