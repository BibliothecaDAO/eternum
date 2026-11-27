import { TroopType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/balance.gen";

export const RESEARCH_ROWS = Object.entries(research)
  .filter(([name]) => name.startsWith("ROW_"))
  .map(([, row]) => row);

const tierFields: Record<number, readonly [offset: bigint, width: bigint]> = {
  [research.ROW_FARM]: [0n, 3n],
  [research.ROW_WORKSHOP]: [7n, 3n],
  [research.ROW_CONSCRIPTION]: [14n, 3n],
  [research.ROW_RATIONS]: [24n, 3n],
  [research.ROW_SUPPLY_YARD]: [27n, 3n],
  [research.ROW_KNIGHT_OATHS]: [30n, 2n],
  [research.ROW_SCOUT_OATHS]: [32n, 2n],
  [research.ROW_CROSSBOW_OATHS]: [34n, 2n],
  [research.ROW_LORE]: [48n, 2n],
};
const field = (learned: bigint, offset: bigint, width: bigint) => Number((learned >> offset) & ((1n << width) - 1n));

export function researchTier(learned: bigint, row: number): number {
  const slot = tierFields[row];
  if (!slot) throw new Error(`Unknown research row ${row}`);
  return field(learned, ...slot);
}

export const OATH_SLOTS_MAX = research.OATH_SLOTS_BASE + research.OATH_SLOTS_STEPS;

export function learnResearch(learned: bigint, row: number): bigint {
  const offset = tierFields[row]?.[0];
  if (offset === undefined) throw new Error(`Unknown research row ${row}`);
  const maximum = isOathResearch(row)
    ? research.OATH_SLOTS_STEPS
    : row === research.ROW_LORE
      ? research.LORE_SPIRES
      : 5;
  if (researchTier(learned, row) >= maximum) throw new Error("Research row is complete");
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

export function reachableDepth(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  structureId: number | bigint,
): 0 | 3 | undefined {
  const learned = realmLearned(store, gameId, structureId);
  if (learned === undefined) return undefined;
  return researchTier(learned, research.ROW_LORE) >= research.LORE_SPIRES ? 3 : 0;
}

/** The building type a building row's tiers apply to, as research.cairo's row_category; castle rows have none. */
export const researchRowCategory: Readonly<Partial<Record<number, number>>> = {
  [research.ROW_FARM]: research.FARM,
  [research.ROW_WORKSHOP]: research.WORKSHOP,
  [research.ROW_CONSCRIPTION]: research.CONSCRIPTION_CAMP,
  [research.ROW_RATIONS]: research.RATIONS_DEPOT,
  [research.ROW_SUPPLY_YARD]: research.SUPPLY_YARD,
  [research.ROW_KNIGHT_OATHS]: research.BARRACKS,
  [research.ROW_SCOUT_OATHS]: research.SCOUTS_LODGE,
  [research.ROW_CROSSBOW_OATHS]: research.RANGE,
};

export function loreOpensAtLevel(tier: number): number {
  if (tier >= research.LORE_SPIRES) return research.SPIRE_LORE_LEVEL;
  return tier === research.LORE_SHRINES ? research.SHRINE_LORE_LEVEL : 0;
}

export function buildingOpensAtLevel(category: number): number {
  const name = Object.entries(research).find(([key, value]) => value === category && `${key}_LEVEL` in research)?.[0];
  return name === undefined ? 0 : research[`${name}_LEVEL` as keyof typeof research];
}

const ONE_PER_REALM = new Set<number>([
  research.SUPPLY_YARD,
  research.CONSCRIPTION_CAMP,
  research.RATIONS_DEPOT,
  research.STOREROOM,
]);

export const isOnePerRealm = (category: number): boolean => ONE_PER_REALM.has(category);

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
  if (category === research.FARM) return researchTier(learned, research.ROW_FARM);
  if (category === research.WORKSHOP) return researchTier(learned, research.ROW_WORKSHOP);
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
