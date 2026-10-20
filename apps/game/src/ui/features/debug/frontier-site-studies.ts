import type { LineupAsset } from "@/three/debug/model-lab/static-model-lineup";
import { FRONTIER_BEASTS, FALLEN_REALM_DEPTHS, FALLEN_REALM_RUIN_PATH } from "@/three/structures/frontier-beast";
import { BEAST_NAMES, BEAST_STUDY_NAMES, CAMP, RIFT, RUIN } from "@/ui/design-system/kit/words";

export const SITE_CONCEPTS = {
  weak: ["ghoul", "kappa", "wraith"],
  ruin: ["basilisk", "ammit", "ent"],
  rift: ["dark-fey"],
} as const;
export const SURFACE_STUDY_SCALE = 1.2;
const FEY_STUDY_SCALE = 0.75;
const studyPath = (species: keyof typeof BEAST_STUDY_NAMES) => `/lab/frontier-beasts/beast-${species}.glb`;
const ruin = { path: FALLEN_REALM_RUIN_PATH, scale: 1 };
const sites: readonly (LineupAsset & { id: string })[] = [
  ...SITE_CONCEPTS.weak.map((species) => ({
    id: species,
    label: `Weak roaming · ${BEAST_STUDY_NAMES[species]}`,
    parts: [{ path: studyPath(species), scale: 0.8 }],
  })),
  {
    id: "cyclops",
    label: `Stronger roaming · ${BEAST_NAMES.cyclops}`,
    parts: [{ path: FRONTIER_BEASTS.cyclops.path, scale: 1 }],
  },
  {
    id: "troll",
    label: `${CAMP} · ${BEAST_NAMES.troll} · all depths`,
    parts: [{ path: FRONTIER_BEASTS.troll.path, scale: 0.85 }],
  },
  {
    id: "dark-fey",
    label: `${RIFT} · ${BEAST_STUDY_NAMES["dark-fey"]} · all depths`,
    parts: [
      { path: "/models/reward-tiles/rift.glb", scale: 0.5, z: -0.42 },
      { path: studyPath("dark-fey"), scale: FEY_STUDY_SCALE, z: 0.35 },
    ],
  },
  ...(["basilisk", "ammit"] as const).map((species) => ({
    id: species,
    label: `${RUIN} Surface · ${BEAST_STUDY_NAMES[species]}`,
    parts: [ruin, { path: studyPath(species), scale: SURFACE_STUDY_SCALE }],
  })),
  ...FALLEN_REALM_DEPTHS.slice(1).map(({ beast, scale }, i) => ({
    id: `ruin-${i + 1}`,
    label: `${RUIN} ${["I", "II", "III"][i]} · ${BEAST_NAMES[beast]}`,
    parts: [ruin, { path: FRONTIER_BEASTS[beast].path, scale }],
  })),
];

/** Each study stands at a hex center; landmark transforms remain local to that tile. */
export const SITE_STUDIES = sites.map((site, index) => ({
  ...site,
  position:
    index < 8
      ? { x: ((index % 4) - 1.5) * Math.sqrt(3) * 2, z: (Math.floor(index / 4) - 1) * 3 }
      : { x: (index - 9) * Math.sqrt(3) * 2, z: 3 },
}));
