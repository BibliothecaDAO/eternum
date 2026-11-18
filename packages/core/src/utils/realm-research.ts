import { TroopType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";

/**
 * Where each research row keeps its tier in RealmKnowledge.learned, exactly as research.cairo packs it: the field's
 * bit offset and width. Farm and Workshop keep two three-bit side counts.
 */
export const RESEARCH_ROWS = Object.entries(research)
  .filter(([name]) => name.startsWith("ROW_"))
  .map(([, row]) => row);

const tierFields: Record<number, readonly [offset: bigint, width: bigint]> = {
  [research.ROW_FARM]: [0n, 3n],
  [research.ROW_WORKSHOP]: [7n, 3n],
  [research.ROW_CONSCRIPTION]: [14n, 3n],
  [research.ROW_HUT]: [21n, 3n],
  [research.ROW_RATIONS]: [24n, 3n],
  [research.ROW_SUPPLY_YARD]: [27n, 3n],
  [research.ROW_KNIGHT_OATHS]: [30n, 2n],
  [research.ROW_SCOUT_OATHS]: [32n, 2n],
  [research.ROW_CROSSBOW_OATHS]: [34n, 2n],
  [research.ROW_SHRINE]: [46n, 1n],
  [research.ROW_WELL]: [47n, 1n],
  [research.ROW_DEPTH]: [48n, 2n],
};
const field = (learned: bigint, offset: bigint, width: bigint) => Number((learned >> offset) & ((1n << width) - 1n));

/** A row's tier: 0 is unresearched, 5 legendary; castle rows count shrines, wells and depths unlocked. */
export function researchTier(learned: bigint, row: number): number {
  const slot = tierFields[row];
  if (!slot) throw new Error(`Unknown research row ${row}`);
  return researchHasIndependentSides(row)
    ? Math.max(field(learned, ...slot), field(learned, slot[0] + 3n, 3n))
    : field(learned, ...slot);
}

export function researchHasIndependentSides(row: number): boolean {
  return row === research.ROW_FARM || row === research.ROW_WORKSHOP;
}

/** Upgrades on one side. */
export function researchPicks(learned: bigint, row: number, side: number): number {
  const slot = tierFields[row];
  if (!slot) throw new Error(`Unknown research row ${row}`);
  const count = researchHasIndependentSides(row) ? 2 : 1;
  if (!Number.isInteger(side) || side < 0 || side >= count) throw new Error(`Invalid research side ${side}`);
  if (researchHasIndependentSides(row)) return field(learned, slot[0] + BigInt(side) * 3n, 3n);
  return researchTier(learned, row);
}

/** Total purchases, including both economy sides. */
export function researchPurchases(learned: bigint, row: number): number {
  return researchHasIndependentSides(row)
    ? researchPicks(learned, row, 0) + researchPicks(learned, row, 1)
    : researchTier(learned, row);
}

export const OATH_SLOTS_MAX = research.OATH_SLOTS_BASE + research.OATH_SLOTS_STEPS;

/**
 * The knowledge after a row's next tier is learned, with `side` the choice at that tier on a row that has one, as
 * research.cairo's learn packs it. Throws for a side the row does not offer.
 */
export function learnResearch(learned: bigint, row: number, side: number): bigint {
  const offset = tierFields[row]?.[0];
  if (offset === undefined) throw new Error(`Unknown research row ${row}`);
  const picks = researchPicks(learned, row, side);
  const next = (researchHasIndependentSides(row) ? picks : researchTier(learned, row)) + 1;
  const maximum =
    row === research.ROW_SHRINE || row === research.ROW_WELL
      ? 1
      : isOathResearch(row)
        ? research.OATH_SLOTS_STEPS
        : row === research.ROW_DEPTH
          ? 3
          : 5;
  if (next > maximum) throw new Error("Research side is complete");
  if (researchHasIndependentSides(row)) return learned + (1n << (offset + BigInt(side) * 3n));
  return learned + (1n << offset);
}

/** Unknown realm knowledge stays unknown. */
export function realmLearned(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  structureId: number | bigint,
): bigint | undefined {
  return store.get("RealmKnowledge", { game_id: gameId, structure_id: structureId })?.learned;
}

/** The deepest Ethereal layer a realm has researched, 0 for none. */
export function researchedDepth(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  structureId: number | bigint,
): number | undefined {
  const learned = realmLearned(store, gameId, structureId);
  return learned === undefined ? undefined : researchTier(learned, research.ROW_DEPTH);
}

/** The building type a building row's tiers apply to, as research.cairo's row_category; castle rows have none. */
export const researchRowCategory: Readonly<Partial<Record<number, number>>> = {
  [research.ROW_FARM]: research.FARM,
  [research.ROW_WORKSHOP]: research.WORKSHOP,
  [research.ROW_HUT]: research.HUT,
  [research.ROW_CONSCRIPTION]: research.CONSCRIPTION_CAMP,
  [research.ROW_RATIONS]: research.RATIONS_DEPOT,
  [research.ROW_SUPPLY_YARD]: research.SUPPLY_YARD,
  [research.ROW_KNIGHT_OATHS]: research.BARRACKS,
  [research.ROW_SCOUT_OATHS]: research.SCOUTS_LODGE,
  [research.ROW_CROSSBOW_OATHS]: research.RANGE,
};

/** The building model's tier: unresearched 0 and Common I share the first of five models. */
export function buildingTypeTier(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  structureId: number | bigint,
  category: number,
): number {
  const row = researchRowOf(category);
  const learned = realmLearned(store, gameId, structureId);
  return row === undefined || learned === undefined ? 1 : Math.max(1, researchTier(learned, row));
}

/** The research row whose tiers apply to a building type, if it has one. */
export function researchRowOf(category: number): number | undefined {
  const row = Object.entries(researchRowCategory).find(([, rowCategory]) => rowCategory === category)?.[0];
  return row === undefined ? undefined : Number(row);
}

export function buildingMakePicks(learned: bigint, category: number): number {
  if (category === research.FARM) return researchPicks(learned, research.ROW_FARM, research.CHOICE_MAKE);
  if (category === research.WORKSHOP) return researchPicks(learned, research.ROW_WORKSHOP, research.CHOICE_MAKE);
  if (category === research.BARRACKS || category === research.RANGE || category === research.SCOUTS_LODGE)
    return researchTier(learned, research.ROW_CONSCRIPTION);
  return 0;
}

export const oathResearchRow = {
  [TroopType.Knight]: research.ROW_KNIGHT_OATHS,
  [TroopType.Crossbowman]: research.ROW_CROSSBOW_OATHS,
  [TroopType.Paladin]: research.ROW_SCOUT_OATHS,
} satisfies Record<TroopType, number>;

export function isOathResearch(row: number): boolean {
  return Object.values(oathResearchRow).some((value) => value === row);
}

export function troopOathSlots(learned: bigint, category: TroopType): number {
  return research.OATH_SLOTS_BASE + researchTier(learned, oathResearchRow[category]);
}

export function oathSlotResearchTier(slotIndex: number): number {
  return slotIndex - research.OATH_SLOTS_BASE + 1;
}
