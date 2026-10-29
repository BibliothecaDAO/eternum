import type { NativeFactStore } from "../client/native-fact-store";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";

/**
 * Where each research row keeps its tier in RealmKnowledge.learned, exactly as research.cairo packs it: the field's
 * bit offset and width. Farm, Workshop and Barracks keep two three-bit side counts.
 * Scouts keeps a shared tier and two bits per purchased tier for its kind.
 */
const tierFields: Record<number, readonly [offset: bigint, width: bigint]> = {
  [research.ROW_FARM]: [0n, 3n],
  [research.ROW_WORKSHOP]: [7n, 3n],
  [research.ROW_BARRACKS]: [14n, 3n],
  [research.ROW_HUT]: [21n, 3n],
  [research.ROW_WAR_HALL]: [24n, 3n],
  [research.ROW_SUPPLY_YARD]: [27n, 3n],
  [research.ROW_SCOUTS_LODGE]: [30n, 3n],
  [research.ROW_HEARTH]: [33n, 3n],
  [research.ROW_SHRINE]: [46n, 1n],
  [research.ROW_WELL]: [47n, 1n],
  [research.ROW_DEPTH]: [48n, 2n],
};
const choiceFields: Record<number, readonly [offset: bigint, width: bigint]> = {
  [research.ROW_SCOUTS_LODGE]: [36n, 2n],
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
  return row === research.ROW_FARM || row === research.ROW_WORKSHOP || row === research.ROW_BARRACKS;
}

/** Upgrades on one side; Scouts counts selections of its kind without changing the shared cap. */
export function researchPicks(learned: bigint, row: number, side: number): number {
  const slot = tierFields[row];
  if (!slot) throw new Error(`Unknown research row ${row}`);
  const count = researchHasIndependentSides(row) ? 2 : row === research.ROW_SCOUTS_LODGE ? 3 : 1;
  if (!Number.isInteger(side) || side < 0 || side >= count) throw new Error(`Invalid research side ${side}`);
  if (researchHasIndependentSides(row)) return field(learned, slot[0] + BigInt(side) * 3n, 3n);
  if (count === 1) return researchTier(learned, row);
  return Array.from({ length: researchTier(learned, row) }, (_, index) =>
    researchChoice(learned, row, index + 1),
  ).filter((choice) => choice === side).length;
}

/** Total purchases, including both sides, for the Barracks training gate. */
export function researchPurchases(learned: bigint, row: number): number {
  return researchHasIndependentSides(row)
    ? researchPicks(learned, row, 0) + researchPicks(learned, row, 1)
    : researchTier(learned, row);
}

/** The kind chosen at a shared Scouts tier, from 1 (Common). */
export function researchChoice(learned: bigint, row: number, tier: number): number {
  const slot = choiceFields[row];
  if (!slot) throw new Error(`Research row ${row} has no choice`);
  if (tier < 1 || tier > researchTier(learned, row))
    throw new Error(`Research row ${row} has not learned tier ${tier}`);
  const [offset, width] = slot;
  return field(learned, offset + width * BigInt(tier - 1), width);
}

/**
 * The knowledge after a row's next tier is learned, with `side` the choice at that tier on a row that has one, as
 * research.cairo's learn packs it. Throws for a side the row does not offer.
 */
export function learnResearch(learned: bigint, row: number, side: number): bigint {
  const offset = tierFields[row]?.[0];
  if (offset === undefined) throw new Error(`Unknown research row ${row}`);
  const picks = researchPicks(learned, row, side);
  const next = (researchHasIndependentSides(row) ? picks : researchTier(learned, row)) + 1;
  const maximum = row === research.ROW_SHRINE || row === research.ROW_WELL ? 1 : row === research.ROW_DEPTH ? 3 : 5;
  if (next > maximum) throw new Error("Research side is complete");
  if (researchHasIndependentSides(row)) return learned + (1n << (offset + BigInt(side) * 3n));
  const choice = choiceFields[row];
  if (!choice) {
    if (side !== 0) throw new Error(`Research row ${row} has no choice`);
    return learned + (1n << offset);
  }
  const [choiceOffset, choiceWidth] = choice;
  if (side < 0 || side >= 1 << Number(choiceWidth)) throw new Error(`Research row ${row} has no side ${side}`);
  return learned + (1n << offset) + (BigInt(side) << (choiceOffset + choiceWidth * BigInt(next - 1)));
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
  [research.ROW_BARRACKS]: research.BARRACKS,
  [research.ROW_HUT]: research.HUT,
  [research.ROW_WAR_HALL]: research.WAR_HALL,
  [research.ROW_SUPPLY_YARD]: research.SUPPLY_YARD,
  [research.ROW_SCOUTS_LODGE]: research.SCOUTS_LODGE,
  [research.ROW_HEARTH]: research.HEARTH,
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
