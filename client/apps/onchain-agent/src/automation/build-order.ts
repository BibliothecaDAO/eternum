/**
 * Hardcoded build orders driven by realm biome.
 *
 * Biome → best troop type → T2/T3 resource path → entire build order.
 * No runtime config needed. The automation walks the list each tick,
 * finds the first un-built step, and builds it.
 *
 * Build order is structured around realm level slot gates:
 *   Settlement (6 slots) → City (18 slots) → Kingdom (36 slots) → Empire (60 slots)
 */

// ── BuildingType numeric values (from @bibliothecadao/types) ──────────
// Inlined to keep this module dependency-free.

const B = {
  WorkersHut: 1,
  Coal: 4,
  Wood: 5,
  Copper: 6,
  Ironwood: 7,
  Gold: 9,
  Mithral: 11,
  ColdIron: 13,
  Adamantine: 21,
  Dragonhide: 24,
  KnightT1: 28,
  KnightT2: 29,
  KnightT3: 30,
  CrossbowmanT1: 31,
  CrossbowmanT2: 32,
  CrossbowmanT3: 33,
  PaladinT1: 34,
  PaladinT2: 35,
  PaladinT3: 36,
  Wheat: 37,
} as const;

// ── Types ─────────────────────────────────────────────────────────────

export type TroopPath = "Knight" | "Crossbowman" | "Paladin";

export interface BuildStep {
  /** BuildingType enum value to construct. */
  building: number;
  /** Human-readable label for logs / debugging. */
  label: string;
}

export interface BuildOrder {
  troopPath: TroopPath;
  steps: BuildStep[];
}

// ── Troop building IDs by path ────────────────────────────────────────

const TROOP_IDS: Record<TroopPath, { t1: number; t2: number; t3: number }> = {
  Knight: { t1: B.KnightT1, t2: B.KnightT2, t3: B.KnightT3 },
  Crossbowman: { t1: B.CrossbowmanT1, t2: B.CrossbowmanT2, t3: B.CrossbowmanT3 },
  Paladin: { t1: B.PaladinT1, t2: B.PaladinT2, t3: B.PaladinT3 },
};

const TROOP_LABELS: Record<TroopPath, { t1: string; t2: string; t3: string }> = {
  Knight: { t1: "KnightT1", t2: "KnightT2", t3: "KnightT3" },
  Crossbowman: { t1: "CrossbowmanT1", t2: "CrossbowmanT2", t3: "CrossbowmanT3" },
  Paladin: { t1: "PaladinT1", t2: "PaladinT2", t3: "PaladinT3" },
};

/** T2 resource building needed for each troop path. */
const T2_RESOURCE: Record<TroopPath, { building: number; label: string }> = {
  Knight: { building: B.ColdIron, label: "ColdIronFoundry" },
  Crossbowman: { building: B.Ironwood, label: "IronwoodMill" },
  Paladin: { building: B.Gold, label: "GoldMine" },
};

/** T3 resource building needed for each troop path. */
const T3_RESOURCE: Record<TroopPath, { building: number; label: string }> = {
  Knight: { building: B.Mithral, label: "MithralForge" },
  Crossbowman: { building: B.Adamantine, label: "AdamantineMine" },
  Paladin: { building: B.Dragonhide, label: "DragonhideTannery" },
};

// ── Build order generator ─────────────────────────────────────────────

function buildSteps(path: TroopPath): BuildStep[] {
  const troop = TROOP_IDS[path];
  const troopLabel = TROOP_LABELS[path];
  const t2Res = T2_RESOURCE[path];
  const t3Res = T3_RESOURCE[path];

  return [
    // ── Settlement: 6 slots ──────────────────────────────────
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Coal, label: "CoalMine" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    // → upgrade to City (18 slots = 12 more)

    // ── City: fill 12 more slots ─────────────────────────────
    // Wheat: 3 (was 2)
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Coal, label: "CoalMine" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: troop.t1, label: troopLabel.t1 },
    { building: troop.t1, label: troopLabel.t1 },
    // → upgrade to Kingdom (36 slots = 18 more)

    // ── Kingdom: fill 18 more slots ──────────────────────────
    // Wheat: 5 (was 4)
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Coal, label: "CoalMine" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    // T2 resource + 2x T2 troop
    { building: t2Res.building, label: t2Res.label },
    { building: troop.t2, label: troopLabel.t2 },
    { building: troop.t2, label: troopLabel.t2 },
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    // → upgrade to Empire (60 slots = 24 more)

    // ── Empire: fill 24 more slots ───────────────────────────
    // Wheat: 8 (was 5)
    // T3 resource + 1x T3 troop
    { building: t3Res.building, label: t3Res.label },
    { building: troop.t3, label: troopLabel.t3 },
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Coal, label: "CoalMine" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Coal, label: "CoalMine" },
    { building: B.WorkersHut, label: "WorkersHut" },
    { building: B.Wood, label: "WoodMill" },
    { building: B.Copper, label: "CopperSmelter" },
    { building: B.Wheat, label: "WheatFarm" },
    { building: B.Wheat, label: "WheatFarm" },
  ];
}

// ── Biome → TroopPath ─────────────────────────────────────────────────

const BIOME_TO_TROOP: Record<number, TroopPath> = {
  // Paladin biomes (+30% damage)
  5: "Paladin", // Bare
  6: "Paladin", // Tundra
  8: "Paladin", // Temperate Desert
  9: "Paladin", // Shrubland
  11: "Paladin", // Grassland
  14: "Paladin", // Subtropical Desert

  // Knight biomes (+30% damage)
  10: "Knight", // Taiga
  12: "Knight", // Temperate Deciduous Forest
  13: "Knight", // Temperate Rain Forest
  15: "Knight", // Tropical Seasonal Forest
  16: "Knight", // Tropical Rain Forest

  // Crossbowman biomes (+30% damage)
  1: "Crossbowman", // Deep Ocean
  2: "Crossbowman", // Ocean
  3: "Crossbowman", // Beach
  4: "Crossbowman", // Scorched
  7: "Crossbowman", // Snow
};

// ── Public API ────────────────────────────────────────────────────────

export function troopPathForBiome(biome: number): TroopPath {
  return BIOME_TO_TROOP[biome] ?? "Paladin";
}

/**
 * Generate the full build order for a realm based on its biome.
 * Structured around realm level slot gates:
 *   Settlement (6) → City (18) → Kingdom (36) → Empire (60)
 */
export function buildOrderForBiome(biome: number): BuildOrder {
  const troopPath = troopPathForBiome(biome);
  return {
    troopPath,
    steps: buildSteps(troopPath),
  };
}
