import type { LineupAsset } from "@/three/debug/model-lab/static-model-lineup";
import { StructureType } from "@bibliothecadao/types";
import {
  FRONTIER_BEASTS,
  FALLEN_REALM_DEPTHS,
  FALLEN_REALM_RUIN_PATH,
  frontierBeast,
  frontierSiteComposition,
} from "@/three/structures/frontier-beast";
import { BEAST_NAMES, CAMP, RIFT, RUIN } from "@/ui/design-system/kit/words";

const site = (
  id: string,
  label: string,
  category: StructureType,
  depth = 0,
  band?: "lowly" | "stronger",
): LineupAsset & { id: string } => {
  const beast = frontierBeast(depth, category, band);
  const composition = frontierSiteComposition(category);
  return {
    id,
    label: `${label} · ${beast.name}`,
    parts: [
      ...(composition.baseScale
        ? [
            {
              path: category === StructureType.Rift ? "/models/reward-tiles/rift.glb" : FALLEN_REALM_RUIN_PATH,
              scale: composition.baseScale,
            },
          ]
        : []),
      { path: FRONTIER_BEASTS[beast.beast].path, scale: beast.scale, y: composition.beastY },
    ],
  };
};

/** The production resolver builds every tile, including camps and rifts below the surface. */
export const SITE_STUDIES = [
  site("cyclops", "Lowly roaming", StructureType.Beasts, 0, "lowly"),
  site("wraith", "Stronger roaming", StructureType.Beasts, 0, "stronger"),
  site("troll", `${CAMP} · all depths`, StructureType.Camp, 3),
  site("dark-fey", `${RIFT} · all depths`, StructureType.Rift, 3),
  ...FALLEN_REALM_DEPTHS.map(({ beast }, depth) =>
    site(beast, `${RUIN} ${["Surface", "I", "II", "III"][depth]}`, StructureType.Ruin, depth),
  ),
].map((entry, index) => ({
  ...entry,
  position: { x: ((index % 4) - 1.5) * Math.sqrt(3) * 2, z: Math.floor(index / 4) * 3 - 1.5 },
}));

export const MIST_STRESS_SITES: readonly LineupAsset[] = Array.from({ length: 100 }, (_, index) => ({
  ...site(`ruin-${index}`, BEAST_NAMES[FALLEN_REALM_DEPTHS[index % 4].beast], StructureType.Ruin, index % 4),
  label: "",
  position: { x: ((index % 10) - 4.5) * Math.sqrt(3), z: (Math.floor(index / 10) - 4.5) * 1.5 },
}));
/** Sixteen of every shipped species, with their actual landmarks and mist. */
export const BEAST_STRESS_SITES: readonly LineupAsset[] = Array.from({ length: 128 }, (_, index) => ({
  ...SITE_STUDIES[index % SITE_STUDIES.length],
  label: "",
  position: { x: ((index % 12) - 5.5) * Math.sqrt(3), z: (Math.floor(index / 12) - 5) * 1.5 },
}));
export const SITE_CONCEPTS = ["wraith", "ammit", "basilisk", "dark-fey"] as const;
