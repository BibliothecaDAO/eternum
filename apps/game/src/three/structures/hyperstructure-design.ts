/** Preserve the existing tower's landmark height. */
export const HYPERSTRUCTURE_HEIGHT = 3.9;
export const HYPERSTRUCTURE_COURSES = 8;
export const HYPERSTRUCTURE_BASE_HEIGHT = 0.22;
export const HYPERSTRUCTURE_SHAFT_HEIGHT = 2.78;
export const HYPERSTRUCTURE_MODEL_PATH = "procedural:hyperstructure";

export const HYPERSTRUCTURE_FAMILIES = ["citadel", "needle", "helix", "trident", "obelisk", "reliquary"] as const;
export const HYPERSTRUCTURE_CROWNS = [
  "prongs",
  "astrolabe",
  "petals",
  "crystals",
  "crescent",
  "cage",
  "spear",
  "wings",
] as const;
export type HyperstructureFamily = (typeof HYPERSTRUCTURE_FAMILIES)[number];
export type HyperstructureCrown = (typeof HYPERSTRUCTURE_CROWNS)[number];
export interface HyperstructureConstruction {
  entityId: number;
  progress: number;
  completed: boolean;
}

export function resolveHyperstructureDesign(entityId: number) {
  let state = (entityId ^ 0x85ebca6b) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    family: HYPERSTRUCTURE_FAMILIES[Math.floor(random() * HYPERSTRUCTURE_FAMILIES.length)],
    crown: HYPERSTRUCTURE_CROWNS[Math.floor(random() * HYPERSTRUCTURE_CROWNS.length)],
    width: 0.8 + random() * 0.35,
    taper: 0.18 + random() * 0.38,
    twist: (random() - 0.5) * 0.5,
    spiral: 0.7 + random() * 1.4,
    rhythm: 2 + Math.floor(random() * 3),
    shoulder: 0.55 + random() * 0.35,
    crownWidth: 0.8 + random() * 0.4,
    phase: random() * Math.PI * 2,
    masonryTint: (
      [
        [0.9, 1, 1.15], // Blue basalt.
        [1.25, 1.08, 0.86], // Warm weathered stone.
        [0.94, 1.12, 1.04], // Green slate.
        [1.4, 1.42, 1.45], // Pale granite.
      ] as const
    )[Math.floor(random() * 4)],
    power: random() < 0.5 ? ("unstable" as const) : ("stable" as const),
  };
}

/** Families change the load-bearing silhouette, not just surface decoration. */
export function resolveHyperstructureCourse(design: ReturnType<typeof resolveHyperstructureDesign>, course: number) {
  const level = course / HYPERSTRUCTURE_COURSES;
  let radius = design.width * (1 - design.taper * level);
  let yaw = design.twist * level;
  switch (design.family) {
    case "citadel":
      radius *= level < design.shoulder ? 1 : 0.72;
      break;
    case "needle":
      radius *= 0.9 - Math.sin((level * Math.PI) / 2) * 0.3;
      break;
    case "helix":
      radius = design.width;
      yaw = design.twist + design.spiral;
      break;
    case "trident":
      radius = design.width;
      yaw = design.twist;
      break;
    case "obelisk":
      radius *= 1.1 - level * 0.2;
      break;
    case "reliquary":
      radius = design.width * (0.94 + design.rhythm * 0.02);
      yaw = design.twist;
      break;
  }
  return { radius, yaw, y: HYPERSTRUCTURE_BASE_HEIGHT + level * HYPERSTRUCTURE_SHAFT_HEIGHT };
}
