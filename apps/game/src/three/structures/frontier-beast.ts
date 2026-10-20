import { readFrontierBeast } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import type { FrontierSpecies, FrontierBeast } from "@bibliothecadao/eternum";
export {
  beastBand,
  frontierBeast,
  FALLEN_REALM_DEPTHS,
  type FrontierSpecies,
  type FrontierBeast,
} from "@bibliothecadao/eternum";

export const FALLEN_REALM_RUIN_PATH = "/models/outposts/ruin.glb";

/** Loot tiers describe species provenance, never the guard's combat tier. */
export const FRONTIER_BEASTS = {
  troll: { path: "/models/frontier/beast-troll.glb", lootSurvivorId: 71, lootTier: 5, maxScale: 1.46 },
  wyvern: { path: "/models/frontier/beast-wyvern.glb", lootSurvivorId: 37, lootTier: 3, maxScale: 1.38 },
  hydra: { path: "/models/frontier/beast-hydra.glb", lootSurvivorId: 59, lootTier: 2, maxScale: 1.7 },
  wraith: { path: "/models/frontier/beast-wraith.glb", lootSurvivorId: 18, lootTier: 4, maxScale: 1 },
  cyclops: { path: "/models/frontier/beast-cyclops.glb", maxScale: 1 },
  ammit: { path: "/models/frontier/beast-ammit.glb", lootSurvivorId: 32, lootTier: 2, maxScale: 1.2 },
  basilisk: { path: "/models/frontier/beast-basilisk.glb", lootSurvivorId: 5, lootTier: 1, maxScale: 1.2 },
  "dark-fey": { path: "/models/frontier/beast-dark-fey.glb", maxScale: 0.75 },
} as const;
const BEAST_ORDER = Object.keys(FRONTIER_BEASTS) as FrontierSpecies[];
export const FRONTIER_BEAST_PATHS = BEAST_ORDER.map((beast) => FRONTIER_BEASTS[beast].path);
export const FALLEN_REALM_MODEL_PATHS = [FALLEN_REALM_RUIN_PATH, ...FRONTIER_BEAST_PATHS];
export const FALLEN_REALM_RUIN_MODEL_INDEX = 0;
export const frontierBeastModelIndex = (beast: FrontierSpecies): number => 1 + BEAST_ORDER.indexOf(beast);

/** Standing models disappear after a clear; history can still name the same encounter. */
export function readStandingFrontierBeast(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  entityId: number,
): FrontierBeast | undefined {
  if (store.get("ExpeditionSite", { game_id: gameId, entity_id: entityId })?.clear) return undefined;
  return readFrontierBeast(store, gameId, entityId);
}

/** Every landmark and guard shares its tile center. The fey clears the rift crown. */
export function frontierSiteComposition(category: StructureType) {
  if (category === StructureType.Ruin) return { baseScale: 1, baseZ: 0, beastZ: 0, beastY: 0 };
  if (category === StructureType.Rift) return { baseScale: 0.5, baseZ: 0, beastZ: 0, beastY: 0.2 };
  return { baseScale: 0, baseZ: 0, beastZ: 0, beastY: 0 };
}
