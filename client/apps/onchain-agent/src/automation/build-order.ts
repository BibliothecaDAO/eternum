/**
 * Biome-driven build orders — maps each realm's biome to its optimal troop
 * specialization and a complete building sequence.
 *
 * WorkersHuts are omitted — the runner auto-injects them when population
 * capacity is the bottleneck (see {@link resolvePlan} in `runner.ts`).
 *
 * Build order is structured around realm level slot gates:
 *   Settlement (6) → City (18) → Kingdom (36) → Empire (60).
 * Actual slot usage is higher due to auto-injected WorkersHuts.
 */

/**
 * BuildingType numeric values (from @bibliothecadao/types).
 * Inlined to keep this module dependency-free.
 */
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

/** Which troop tier progression the realm is optimised for, determined by biome. */
export type TroopPath = "Knight" | "Crossbowman" | "Paladin";

/** A single step in the realm's build sequence. */
export interface BuildStep {
  /** BuildingType enum value to construct. */
  building: number;
  /** Human-readable label for logs / debugging. */
  label: string;
  /** Minimum realm level required for this step (0=Settlement, 1=City, 2=Kingdom, 3=Empire). */
  minLevel: number;
}

/** Complete biome-specific build plan pairing a troop path with an ordered step list. */
export interface BuildOrder {
  /** The troop specialisation chosen for this realm's biome. */
  troopPath: TroopPath;
  /** Ordered list of buildings to construct, from first slot to Empire capacity. */
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

  // WorkersHuts are NOT listed here — the runner auto-injects them
  // whenever population capacity is the bottleneck (see runner.ts resolvePlan).
  // Totals at Empire: 10W, 10Cu, 7Co, 10Wh, 5T1, 1T2Res, 2T2, 1T3Res, 1T3 = 47
  // ~16 slots filled by auto-injected WorkersHuts → fits within 60.
  return [
    // ── Settlement (level 0): 6 slots ─────────────────────────
    { building: B.Wheat, label: "WheatFarm", minLevel: 0 },
    { building: B.Wood, label: "WoodMill", minLevel: 0 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 0 },
    { building: B.Coal, label: "CoalMine", minLevel: 0 },
    { building: B.Wheat, label: "WheatFarm", minLevel: 0 },
    { building: B.Wood, label: "WoodMill", minLevel: 0 },

    // ── City (level 1): 12 more slots ────────────────────────
    { building: B.Wheat, label: "WheatFarm", minLevel: 1 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 1 },
    { building: B.Coal, label: "CoalMine", minLevel: 1 },
    { building: B.Wood, label: "WoodMill", minLevel: 1 },
    { building: troop.t1, label: troopLabel.t1, minLevel: 1 },
    { building: troop.t1, label: troopLabel.t1, minLevel: 1 },
    { building: B.Wheat, label: "WheatFarm", minLevel: 1 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 1 },
    { building: B.Wood, label: "WoodMill", minLevel: 1 },
    { building: troop.t1, label: troopLabel.t1, minLevel: 1 },
    { building: troop.t1, label: troopLabel.t1, minLevel: 1 },
    { building: B.Coal, label: "CoalMine", minLevel: 1 },

    // ── Kingdom (level 2): 18 more slots ─────────────────────
    { building: B.Wheat, label: "WheatFarm", minLevel: 2 },
    { building: B.Wood, label: "WoodMill", minLevel: 2 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 2 },
    { building: B.Coal, label: "CoalMine", minLevel: 2 },
    { building: t2Res.building, label: t2Res.label, minLevel: 2 },
    { building: troop.t2, label: troopLabel.t2, minLevel: 2 },
    { building: troop.t2, label: troopLabel.t2, minLevel: 2 },
    { building: B.Wheat, label: "WheatFarm", minLevel: 2 },
    { building: B.Wood, label: "WoodMill", minLevel: 2 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 2 },
    { building: troop.t1, label: troopLabel.t1, minLevel: 2 },
    { building: B.Wheat, label: "WheatFarm", minLevel: 2 },
    { building: B.Wood, label: "WoodMill", minLevel: 2 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 2 },
    { building: B.Coal, label: "CoalMine", minLevel: 2 },
    { building: B.Wood, label: "WoodMill", minLevel: 2 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 2 },

    // ── Empire (level 3): fill remaining slots ───────────────
    { building: t3Res.building, label: t3Res.label, minLevel: 3 },
    { building: troop.t3, label: troopLabel.t3, minLevel: 3 },
    { building: B.Wheat, label: "WheatFarm", minLevel: 3 },
    { building: B.Wood, label: "WoodMill", minLevel: 3 },
    { building: B.Copper, label: "CopperSmelter", minLevel: 3 },
    { building: B.Coal, label: "CoalMine", minLevel: 3 },
    { building: B.Wheat, label: "WheatFarm", minLevel: 3 },
    { building: B.Wheat, label: "WheatFarm", minLevel: 3 },
    { building: troop.t2, label: troopLabel.t2, minLevel: 3 },
    { building: B.Coal, label: "CoalMine", minLevel: 3 },
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

/**
 * Return the optimal troop path for a given biome.
 *
 * Defaults to Paladin for unknown biomes.
 *
 * @param biome - Numeric biome ID of the realm's home tile.
 * @returns The troop path that receives a +30% damage bonus in this biome.
 */
export function troopPathForBiome(biome: number): TroopPath {
  return BIOME_TO_TROOP[biome] ?? "Paladin";
}

/**
 * Generate the full build order for a realm based on its biome.
 *
 * Structured around realm level slot gates:
 *   Settlement (6) → City (18) → Kingdom (36) → Empire (60).
 *
 * @param biome - Numeric biome ID of the realm's home tile.
 * @returns A BuildOrder with the biome-optimal troop path and full step list.
 */
export function buildOrderForBiome(biome: number): BuildOrder {
  const troopPath = troopPathForBiome(biome);
  return {
    troopPath,
    steps: buildSteps(troopPath),
  };
}
