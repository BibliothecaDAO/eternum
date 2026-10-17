import { mineMeaning, structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";

import type { ArmyData, StructureInfo } from "../types";

/** How the viewer stands to a thing's owner: it colours the plate's side bar and a player's name. */
export type PlateRelation = "own" | "ally" | "enemy" | "neutral";

/** A troop stack: a guard slot, or an army's troops. Its painting is its type and tier (`knight-t2`). */
export interface PlateTroops {
  type: "crossbowman" | "knight" | "paladin";
  tier: 1 | 2 | 3;
  count: number;
}

/** An army's plate: its owner over its troops and stamina; opened, the realm it comes from and its id. */
export interface ArmyPlate {
  kind: "army";
  relation: PlateRelation;
  owner: string;
  homeName: string;
  code: string;
  troops: PlateTroops;
  /** Filled from 0 to 1; absent when the stamina is not known. */
  stamina?: number;
}

/**
 * A structure's plate: a named one (a realm, a hyperstructure) by its name, a nameless one by its kind's painting and
 * what it yields; then its guard. Opened: its owner, a realm's level or the thing's id, and its guard slots.
 */
export interface StructurePlate {
  kind: "structure";
  relation: PlateRelation;
  /** A realm's or a hyperstructure's own name; absent for a nameless thing. */
  title?: string;
  /** The kind's painting, drawn where a nameless thing has no name. */
  icon: IconMeaning;
  owner?: string;
  /** "Bandits" for an unowned camp, else "Unclaimed": what an opened plate says of nobody's thing. */
  nobody: string;
  level?: number;
  code: string;
  /** What taking it yields (a rift's essence), by its resource. */
  yields?: ResourcesIds;
  /** Guard slots in slot order; empty when it stands open. */
  guards: PlateTroops[];
  /** Troops on their way to it (the player's own reinforcements), soonest first, at most three. */
  arrivals: { troops: PlateTroops; secondsLeft: number }[];
}

export type MapPlate = ArmyPlate | StructurePlate;

const LOCAL_RANGE = 2 ** 32;

/** A thing's short id, read off its entity id: its home namespace and serial ("19·21"). */
export const homeCode = (entityId: number): string => `${Math.floor(entityId / LOCAL_RANGE)}·${entityId % LOCAL_RANGE}`;

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
    | "level"
    | "isMine"
    | "isAlly"
    | "owner"
    | "guardArmies"
    | "incomingTroopArrivals"
  >,
  nowSeconds = 0,
): StructurePlate => {
  const named = NAMED.has(structure.structureType) && structure.structureName.trim().length > 0;
  const isRift = structure.structureType === StructureType.Rift || structure.mineKind === 1;
  return {
    kind: "structure",
    relation: relationOf(structure),
    title: named ? structure.structureName.trim() : undefined,
    icon:
      structure.structureType === StructureType.Mine && structure.mineKind !== undefined
        ? mineMeaning(structure.mineKind)
        : structureMeaning(structure.structureType),
    owner: structure.owner.address === 0n ? undefined : structure.owner.ownerName.trim() || undefined,
    nobody: structure.structureType === StructureType.Camp ? "Bandits" : "Unclaimed",
    level: structure.structureType === StructureType.Realm ? structure.level + 1 : undefined,
    code: homeCode(Number(structure.entityId)),
    yields: isRift ? ResourcesIds.Essence : undefined,
    guards: (structure.guardArmies ?? [])
      .filter((guard) => guard.count > 0)
      .toSorted((a, b) => a.slot - b.slot)
      .map((guard) => ({ type: troopType(guard.category), tier: tierOf(guard.tier), count: guard.count })),
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
  owner: army.owner.ownerName.trim(),
  homeName,
  code: homeCode(Number(army.entityId)),
  troops: { type: troopType(army.category), tier: tierOf(army.tier), count: army.troopCount },
  stamina:
    army.currentStamina === undefined || army.maxStamina <= 0
      ? undefined
      : Math.max(0, Math.min(1, army.currentStamina / army.maxStamina)),
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
