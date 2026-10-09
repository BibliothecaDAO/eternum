import type { NativeFactStore } from "../client/native-fact-store";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";

/**
 * Where each research row keeps its tier in RealmKnowledge.learned, exactly as research.cairo packs it: the field's
 * bit offset and width. Farm, Workshop and Barracks keep one bit per tier for their choice after the tier; the
 * Scouts' lodge keeps two bits per tier for its kind.
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
  [research.ROW_SHRINE]: [44n, 1n],
  [research.ROW_WELL]: [45n, 1n],
  [research.ROW_DEPTH]: [46n, 2n],
};
const choiceFields: Record<number, readonly [offset: bigint, width: bigint]> = {
  [research.ROW_FARM]: [3n, 1n],
  [research.ROW_WORKSHOP]: [10n, 1n],
  [research.ROW_BARRACKS]: [17n, 1n],
  [research.ROW_SCOUTS_LODGE]: [36n, 2n],
};

const field = (learned: bigint, offset: bigint, width: bigint) => Number((learned >> offset) & ((1n << width) - 1n));

/** A row's tier: 0 is common, 4 legendary; castle rows count shrines, wells and depths unlocked. */
export function researchTier(learned: bigint, row: number): number {
  const slot = tierFields[row];
  if (!slot) throw new Error(`Unknown research row ${row}`);
  return field(learned, ...slot);
}

/** The side a row took at one of its tiers, from 1 (uncommon). */
export function researchChoice(learned: bigint, row: number, tier: number): number {
  const slot = choiceFields[row];
  if (!slot) throw new Error(`Research row ${row} has no choice`);
  if (tier < 1 || tier > researchTier(learned, row))
    throw new Error(`Research row ${row} has not learned tier ${tier}`);
  const [offset, width] = slot;
  return field(learned, offset + width * BigInt(tier - 1), width);
}

/** Knowledge holding one row alone at `tier`, every choice on its first side (Fields, Tools, Drill, camps). */
export function rowAtTier(row: number, tier: number): bigint {
  const slot = tierFields[row];
  if (!slot) throw new Error(`Unknown research row ${row}`);
  return BigInt(tier) << slot[0];
}

/** Unknown realm knowledge stays unknown. */
export function realmLearned(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  structureId: number,
): bigint | undefined {
  return store.get("RealmKnowledge", { game_id: gameId, structure_id: structureId })?.learned;
}

/** The deepest Ethereal layer a realm has researched, 0 for none. */
export function researchedDepth(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  structureId: number,
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

/** A building type's tier on a realm, 1 (common) to 5 (legendary): every building of the type stands at it. */
export function buildingTypeTier(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  structureId: number,
  category: number,
): number {
  const row = researchRowOf(category);
  const learned = realmLearned(store, gameId, structureId);
  return row === undefined || learned === undefined ? 1 : researchTier(learned, row) + 1;
}

/** The research row whose tiers apply to a building type, if it has one. */
export function researchRowOf(category: number): number | undefined {
  const row = Object.entries(researchRowCategory).find(([, rowCategory]) => rowCategory === category)?.[0];
  return row === undefined ? undefined : Number(row);
}
