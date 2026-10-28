import { type IconMeaning, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { ESSENCE, LABOR, TROOPS, WHEAT } from "@/ui/design-system/kit/words";
import { researchRowCategory } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { type BuildingType, ResourcesIds } from "@bibliothecadao/types";

/** Where a full store is spent: labor on the realm board, wheat and troops by Deploy. */
export type SpentAt = "realm" | "deploy";

type Store = {
  resource: ResourcesIds;
  icon: IconMeaning;
  word: string;
  /** The building that makes it, by its research row (the row's building type, as research.cairo names it). */
  made?: { row: number; spentAt: SpentAt };
};

/**
 * Frontier's stores, in the strip's order: the one table every surface reads (the strip, the realm panel, the store
 * cards, Next up, the build sheet and the makers' lines). Each holds a resource, drawn and named as that resource; the
 * three a building makes name its research row and where they are spent when full. Essence has no building and no
 * limit.
 */
export const FRONTIER_STORES = {
  essence: { resource: ResourcesIds.Essence, icon: resourceMeaning(ResourcesIds.Essence), word: ESSENCE },
  labor: {
    resource: ResourcesIds.Labor,
    icon: resourceMeaning(ResourcesIds.Labor),
    word: LABOR,
    made: { row: research.ROW_WORKSHOP, spentAt: "realm" },
  },
  wheat: {
    resource: ResourcesIds.Wheat,
    icon: resourceMeaning(ResourcesIds.Wheat),
    word: WHEAT,
    made: { row: research.ROW_FARM, spentAt: "deploy" },
  },
  // One troop type: the barracks train the realm's troops, drawn as troops rather than one tier's painting.
  troops: {
    resource: ResourcesIds.Knight,
    icon: "troops",
    word: TROOPS,
    made: { row: research.ROW_BARRACKS, spentAt: "deploy" },
  },
} as const satisfies Record<string, Store>;

export type StoreKind = keyof typeof FRONTIER_STORES;
export const STORE_KINDS = Object.keys(FRONTIER_STORES) as StoreKind[];

/** A store a building makes. */
export type MadeStore = {
  [K in StoreKind]: (typeof FRONTIER_STORES)[K] extends { made: object } ? K : never;
}[StoreKind];
export const isMadeStore = (kind: string): kind is MadeStore =>
  kind in FRONTIER_STORES && "made" in FRONTIER_STORES[kind as StoreKind];
export const MADE_STORES = STORE_KINDS.filter(isMadeStore);

/** What a made store holds. */
export type MadeResource = (typeof FRONTIER_STORES)[MadeStore]["resource"];

/** The building type that makes a store: its research row's. */
export const storeBuilding = (kind: MadeStore): BuildingType => {
  const category = researchRowCategory[FRONTIER_STORES[kind].made.row];
  if (category === undefined) throw new Error(`Research row ${FRONTIER_STORES[kind].made.row} has no building`);
  return category;
};

/** The made store that holds a resource, if one does. */
export const madeStoreOf = (resource: number | undefined): MadeStore | undefined =>
  MADE_STORES.find((kind) => FRONTIER_STORES[kind].resource === resource);

/** The made store that holds a resource a building makes; a resource no Frontier building makes is loud. */
export const madeStore = (resource: MadeResource): MadeStore => {
  const kind = madeStoreOf(resource);
  if (!kind) throw new Error(`No Frontier building makes resource ${resource}`);
  return kind;
};

/** The made store a building type makes, if it makes one. */
export const storeMadeBy = (category: number): MadeStore | undefined =>
  MADE_STORES.find((kind) => storeBuilding(kind) === category);
