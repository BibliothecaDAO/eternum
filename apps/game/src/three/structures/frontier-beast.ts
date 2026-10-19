import { expeditionDepth, readExpeditionRules } from "@bibliothecadao/eternum";
import { StructureType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { BEAST_NAMES } from "@/ui/design-system/kit/words";

export const FALLEN_REALM_RUIN_PATH = "/models/outposts/ruin.glb";

/** Loot tiers describe species provenance, never the guard's combat tier. */
export const FRONTIER_BEASTS = {
  troll: { path: "/models/frontier/beast-troll.glb", lootSurvivorId: 71, lootTier: 5, maxScale: 1.46 },
  wyvern: { path: "/models/frontier/beast-wyvern.glb", lootSurvivorId: 37, lootTier: 3, maxScale: 1.38 },
  hydra: { path: "/models/frontier/beast-hydra.glb", lootSurvivorId: 59, lootTier: 2, maxScale: 1.7 },
  minotaur: { path: "/models/frontier/beast-minotaur.glb", maxScale: 1 },
  cyclops: { path: "/models/frontier/beast-cyclops.glb", maxScale: 1 },
} as const;
export type FrontierSpecies = keyof typeof FRONTIER_BEASTS;
export interface FrontierBeast {
  beast: FrontierSpecies;
  name: string;
  scale: number;
}
export const FALLEN_REALM_DEPTHS: readonly { beast: FrontierSpecies; scale: number }[] = [
  { beast: "troll", scale: 1.2 },
  { beast: "wyvern", scale: 1.35 },
  { beast: "hydra", scale: 1.45 },
  { beast: "hydra", scale: 1.7 },
];
export type BeastBand = "lowly" | "stronger";
const ROAMING_BEASTS = { lowly: { beast: "minotaur", scale: 0.8 }, stronger: { beast: "cyclops", scale: 1 } } as const;
type BeastBounds = Pick<
  NativeRows["DepthRules"],
  "beast_weak_lower" | "beast_weak_upper" | "beast_strong_lower" | "beast_strong_upper"
>;

/** Initial guard strength identifies the encounter even after casualties. */
export function beastBand(initialCount: bigint, bounds: BeastBounds): BeastBand {
  const precision = BigInt(RESOURCE_PRECISION);
  const weakLower = BigInt(bounds.beast_weak_lower) * precision;
  const weakUpper = BigInt(bounds.beast_weak_upper) * precision;
  const strongLower = BigInt(bounds.beast_strong_lower) * precision;
  const strongUpper = BigInt(bounds.beast_strong_upper) * precision;
  if (weakLower <= 0n || weakUpper < weakLower || strongLower <= weakUpper || strongUpper < strongLower)
    throw new Error("Beast depth rules require positive, separate strength ranges");
  if (initialCount >= weakLower && initialCount <= weakUpper) return "lowly";
  if (initialCount >= strongLower && initialCount <= strongUpper) return "stronger";
  throw new Error(`Initial beast strength ${initialCount} is outside its depth ranges`);
}

/** One identity for model, plate and panel. Neither casualties nor reward rank can change it. */
export function frontierBeast(depth: number, category = StructureType.Ruin, band?: BeastBand): FrontierBeast {
  const entry = FALLEN_REALM_DEPTHS[depth];
  if (!entry) throw new Error(`No Frontier beast for depth ${depth}`);
  if (category === StructureType.Beasts) {
    if (!band) throw new Error("Beast identity requires its initial strength band");
    const roaming = ROAMING_BEASTS[band];
    return { ...roaming, name: BEAST_NAMES[roaming.beast] };
  }
  return {
    beast: entry.beast,
    scale: category === StructureType.Ruin ? entry.scale : 0.85,
    name: BEAST_NAMES[entry.beast],
  };
}

const BEAST_ORDER = Object.keys(FRONTIER_BEASTS) as FrontierSpecies[];
export const FRONTIER_BEAST_PATHS = BEAST_ORDER.map((beast) => FRONTIER_BEASTS[beast].path);
export const FALLEN_REALM_MODEL_PATHS = [FALLEN_REALM_RUIN_PATH, ...FRONTIER_BEAST_PATHS];
export const FALLEN_REALM_RUIN_MODEL_INDEX = 0;
export const frontierBeastModelIndex = (beast: FrontierSpecies): number => 1 + BEAST_ORDER.indexOf(beast);

export function readStandingFrontierBeast(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  entityId: number,
  tile: { row: number },
): FrontierBeast | undefined {
  const structure = store.get("Structure", { game_id: gameId, entity_id: entityId });
  const site = store.get("ExpeditionSite", { game_id: gameId, entity_id: entityId });
  if (!site || site.clear || !structure) return undefined;
  const category = structure.base.category;
  if (![StructureType.Ruin, StructureType.Camp, StructureType.Rift, StructureType.Beasts].includes(category))
    return undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error(`Frontier site ${entityId} stands without expedition rules`);
  const depth = expeditionDepth(rules, { y: tile.row });
  if (category !== StructureType.Beasts) return frontierBeast(depth, category);
  const bounds = store.get("DepthRules", { game_id: gameId, depth });
  if (!bounds) throw new Error(`Frontier beast ${entityId} stands without depth rules`);
  return frontierBeast(depth, category, beastBand(site.initial_guard_count, bounds));
}

/** Landmarks sit behind the beast; a ruin retains its measured courtyard composition. */
export function frontierSiteComposition(category: StructureType) {
  if (category === StructureType.Ruin) return { baseScale: 1, baseZ: 0, beastZ: 0 };
  if (category === StructureType.Beasts) return { baseScale: 0, baseZ: 0, beastZ: 0 };
  return { baseScale: 0.5, baseZ: -0.42, beastZ: 0.35 };
}
