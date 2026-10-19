import { expeditionDepth, readExpeditionRules } from "@bibliothecadao/eternum";
import { StructureType, type TroopType } from "@bibliothecadao/types";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { BEAST_NAMES } from "@/ui/design-system/kit/words";

export const FALLEN_REALM_RUIN_PATH = "/models/outposts/ruin.glb";

/** Loot tiers describe species provenance, never the guard's combat tier. */
export const FRONTIER_BEASTS = {
  troll: { path: "/models/frontier/beast-troll.glb", lootSurvivorId: 71, lootTier: 5, maxScale: 1.46 },
  wyvern: { path: "/models/frontier/beast-wyvern.glb", lootSurvivorId: 37, lootTier: 3, maxScale: 1.38 },
  hydra: { path: "/models/frontier/beast-hydra.glb", lootSurvivorId: 59, lootTier: 2, maxScale: 1.7 },
  wolf: { path: "/models/frontier/beast-wolf.glb", lootSurvivorId: 47, lootTier: 5, maxScale: 1 },
  goblin: { path: "/models/frontier/beast-goblin.glb", lootSurvivorId: 16, lootTier: 4, maxScale: 1 },
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
const STRAGGLER_SPECIES: Record<TroopType, FrontierSpecies> = {
  Knight: "troll",
  Paladin: "wolf",
  Crossbowman: "goblin",
};

/** One identity for model, plate and panel. Neither casualties nor reward rank can change it. */
export function frontierBeast(
  depth: number,
  category = StructureType.Ruin,
  troop: TroopType = "Knight",
): FrontierBeast {
  const entry = FALLEN_REALM_DEPTHS[depth];
  if (!entry) throw new Error(`No Frontier beast for depth ${depth}`);
  const beast = category === StructureType.Stragglers ? STRAGGLER_SPECIES[troop] : entry.beast;
  const scale = category === StructureType.Ruin ? entry.scale : category === StructureType.Stragglers ? 1 : 0.85;
  return { beast, scale, name: BEAST_NAMES[beast] };
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
  if (![StructureType.Ruin, StructureType.Camp, StructureType.Rift, StructureType.Stragglers].includes(category))
    return undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error(`Frontier site ${entityId} stands without expedition rules`);
  const guard = store.get("Guard", { game_id: gameId, structure_id: entityId, slot: 0 });
  if (category === StructureType.Stragglers && !guard) return undefined;
  return frontierBeast(expeditionDepth(rules, { y: tile.row }), category, guard?.troops.category);
}

/** Landmarks sit behind the beast; a ruin retains its measured courtyard composition. */
export function frontierSiteComposition(category: StructureType) {
  if (category === StructureType.Ruin) return { baseScale: 1, baseZ: 0, beastZ: 0 };
  if (category === StructureType.Stragglers) return { baseScale: 0, baseZ: 0, beastZ: 0 };
  return { baseScale: 0.5, baseZ: -0.42, beastZ: 0.35 };
}
