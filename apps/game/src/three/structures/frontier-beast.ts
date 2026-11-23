import { readFrontierBeast } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  BEASTS,
  DEEP_BEASTS,
  DEEPLESS_FOURTH_LAYER_BEASTS,
  StructureType,
  beastModel,
  type BeastModel,
} from "@bibliothecadao/types";
import type { FrontierSpecies, FrontierBeast } from "@bibliothecadao/eternum";
import { modelPath } from "../utils/model-url";
export { beastBand, frontierBeast, type FrontierSpecies, type FrontierBeast } from "@bibliothecadao/eternum";

export const FALLEN_REALM_RUIN_PATH = modelPath("outposts/ruin.glb");

export const FRONTIER_BEASTS = {
  troll: { path: modelPath("frontier/beast-troll.glb") },
  wyvern: { path: modelPath("frontier/beast-wyvern.glb") },
  hydra: { path: modelPath("frontier/beast-hydra.glb") },
  wraith: { path: modelPath("frontier/beast-wraith.glb") },
  cyclops: { path: modelPath("frontier/beast-cyclops.glb") },
  ammit: { path: modelPath("frontier/beast-ammit.glb") },
  basilisk: { path: modelPath("frontier/beast-basilisk.glb") },
  "dark-fey": { path: modelPath("frontier/beast-dark-fey.glb") },
  balrog: { path: modelPath("frontier/beast-balrog.glb") },
  colossus: { path: modelPath("frontier/beast-colossus.glb") },
  warlock: { path: modelPath("frontier/beast-warlock.glb") },
  banshee: { path: modelPath("frontier/beast-banshee.glb") },
  golem: { path: modelPath("frontier/beast-golem.glb") },
  kappa: { path: modelPath("frontier/beast-kappa.glb") },
  tarrasque: { path: modelPath("frontier/beast-tarrasque.glb") },
  lich: { path: modelPath("frontier/beast-lich.glb") },
  ettin: { path: modelPath("frontier/beast-ettin.glb") },
  kitsune: { path: modelPath("frontier/beast-kitsune.glb") },
  minotaur: { path: modelPath("frontier/beast-minotaur.glb") },
} as const satisfies Record<FrontierSpecies, { path: string }>;

export const largestBeastScale = (species: BeastModel): number => {
  const rows = [
    ...Object.values(BEASTS),
    ...Object.values(DEEPLESS_FOURTH_LAYER_BEASTS),
    ...Object.values(DEEP_BEASTS),
  ];
  const scales = rows.filter((row) => beastModel(row) === species).map((row) => row.scale);
  if (scales.length === 0) throw new Error(`No beast row stands on the ${species} model`);
  return Math.max(...scales);
};
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
  // The painted slab has a 0.795 apothem; the terrain hex has sqrt(3) / 2.
  if (category === StructureType.Rift) return { baseScale: 1.09, baseZ: 0, beastZ: 0, beastY: 0.2 };
  return { baseScale: 0, baseZ: 0, beastZ: 0, beastY: 0 };
}
