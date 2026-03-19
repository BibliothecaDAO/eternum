/**
 * Production planner — budget-capped, dependency-ordered.
 *
 * Given resource balances, building counts, and game config,
 * calculates how many production cycles to run for each resource
 * THIS tick. Inputs are consumed from a shared budget (90% of
 * balance) so downstream recipes see reduced availability.
 *
 * Processing order:
 *   1. T1 resources (Wood, Coal, Copper)
 *   2. Donkeys
 *   3. T2 resources (path-specific: ColdIron / Ironwood / Gold)
 *   4. T3 resources (path-specific: Mithral / Adamantine / Dragonhide)
 *   5. T1 troops
 *   6. T2 troops (if building exists)
 *   7. T3 troops (if building exists)
 *
 * Each resource gets both complex and simple targets (if recipes
 * exist), so both methods run in a single pass.
 */

import type { GameConfig } from "@bibliothecadao/torii";
import type { TroopPath } from "./build-order.js";

// ── Types ─────────────────────────────────────────────────────────────

interface ProductionCall {
  resourceId: number;
  cycles: number;
  produced: number;
  method: "complex" | "simple";
}

interface ProductionPlan {
  calls: ProductionCall[];
  consumed: Map<number, number>;
  produced: Map<number, number>;
  skipped: Array<{ resourceId: number; reason: string }>;
}

/** A candidate building to construct, with pre-computed scaled costs for budget checking. */
export interface BuildingTarget {
  /** BuildingType numeric value of the building to construct. */
  buildingType: number;
  /** Human-readable label used in logs and status output. */
  label: string;
  /** Scaled resource costs for this specific instance (accounts for quantity-based price increases). */
  costs: { resource: number; amount: number }[];
  /** Whether to use the simple (labor-only) recipe rather than the complex one. */
  useSimple: boolean;
  /** Opaque SlotResult from placement — passed through to the executor unchanged. */
  slot: any; // SlotResult — opaque to the planner
}

interface UnifiedPlan extends ProductionPlan {
  affordableBuilds: BuildingTarget[];
  skippedBuilds: Array<{ label: string; reason: string }>;
}

// ── Resource & building IDs ──────────────────────────────────────────

const R = {
  Coal: 2,
  Wood: 3,
  Copper: 4,
  Ironwood: 5,
  Gold: 7,
  Mithral: 9,
  ColdIron: 11,
  Adamantine: 19,
  Dragonhide: 22,
  Donkey: 25,
  Knight: 26,
  KnightT2: 27,
  KnightT3: 28,
  Crossbowman: 29,
  CrossbowmanT2: 30,
  CrossbowmanT3: 31,
  Paladin: 32,
  PaladinT2: 33,
  PaladinT3: 34,
} as const;

// BuildingType for troop buildings (not resource+2 offset)
const TROOP_BUILDING = {
  KnightT1: 28,
  KnightT2: 29,
  KnightT3: 30,
  CrossbowmanT1: 31,
  CrossbowmanT2: 32,
  CrossbowmanT3: 33,
  PaladinT1: 34,
  PaladinT2: 35,
  PaladinT3: 36,
} as const;

// Resource ID → building type offset for resource buildings
const RESOURCE_TO_BUILDING_OFFSET = 2;

interface TroopPathConfig {
  t1: number;
  t2: number;
  t3: number;
  t2Resource: number;
  t3Resource: number;
  t1Building: number;
  t2Building: number;
  t3Building: number;
}

const TROOP_PATHS: Record<TroopPath, TroopPathConfig> = {
  Knight: {
    t1: R.Knight,
    t2: R.KnightT2,
    t3: R.KnightT3,
    t2Resource: R.ColdIron,
    t3Resource: R.Mithral,
    t1Building: TROOP_BUILDING.KnightT1,
    t2Building: TROOP_BUILDING.KnightT2,
    t3Building: TROOP_BUILDING.KnightT3,
  },
  Crossbowman: {
    t1: R.Crossbowman,
    t2: R.CrossbowmanT2,
    t3: R.CrossbowmanT3,
    t2Resource: R.Ironwood,
    t3Resource: R.Adamantine,
    t1Building: TROOP_BUILDING.CrossbowmanT1,
    t2Building: TROOP_BUILDING.CrossbowmanT2,
    t3Building: TROOP_BUILDING.CrossbowmanT3,
  },
  Paladin: {
    t1: R.Paladin,
    t2: R.PaladinT2,
    t3: R.PaladinT3,
    t2Resource: R.Gold,
    t3Resource: R.Dragonhide,
    t1Building: TROOP_BUILDING.PaladinT1,
    t2Building: TROOP_BUILDING.PaladinT2,
    t3Building: TROOP_BUILDING.PaladinT3,
  },
};

// ── Production target resolution ─────────────────────────────────────

interface ProductionTarget {
  resourceId: number;
  method: "complex" | "simple";
  buildingCount: number;
}

/**
 * Build the ordered list of what to produce this tick.
 *
 * Only includes resources the realm can actually produce (has the corresponding
 * building). Ordered by dependency level so upstream resources are produced
 * before downstream consumers.
 */
function resolveTargets(
  troopPath: TroopPath,
  buildingCounts: Map<number, number>,
  gameConfig: GameConfig,
): ProductionTarget[] {
  const targets: ProductionTarget[] = [];
  const tp = TROOP_PATHS[troopPath];

  function getBuildingCount(buildingType: number): number {
    return buildingCounts.get(buildingType) ?? 0;
  }

  function hasRecipe(resourceId: number, method: "complex" | "simple"): boolean {
    const factory = gameConfig.resourceFactories[resourceId];
    if (!factory) return false;
    if (method === "complex") return factory.complexInputs.length > 0 && factory.outputPerComplexInput > 0;
    return factory.simpleInputs.length > 0 && factory.outputPerSimpleInput > 0;
  }

  /** Add complex then simple targets for a resource if the building exists. */
  function addResource(resourceId: number, buildingType: number) {
    const count = getBuildingCount(buildingType);
    if (count <= 0) return;
    if (hasRecipe(resourceId, "complex")) {
      targets.push({ resourceId, method: "complex", buildingCount: count });
    }
    if (hasRecipe(resourceId, "simple")) {
      targets.push({ resourceId, method: "simple", buildingCount: count });
    }
  }

  // Level 1: T1 resources
  addResource(R.Wood, R.Wood + RESOURCE_TO_BUILDING_OFFSET);
  addResource(R.Coal, R.Coal + RESOURCE_TO_BUILDING_OFFSET);
  addResource(R.Copper, R.Copper + RESOURCE_TO_BUILDING_OFFSET);

  // Donkeys (resource 25, building 27)
  const DONKEY_RESOURCE = 25;
  const DONKEY_BUILDING = DONKEY_RESOURCE + RESOURCE_TO_BUILDING_OFFSET;
  addResource(DONKEY_RESOURCE, DONKEY_BUILDING);

  // Level 2: T2 resource (path-specific)
  addResource(tp.t2Resource, tp.t2Resource + RESOURCE_TO_BUILDING_OFFSET);

  // Level 3: T3 resource (path-specific)
  addResource(tp.t3Resource, tp.t3Resource + RESOURCE_TO_BUILDING_OFFSET);

  // Level 4-6: Troops (use troop-specific building types, not offset)
  addResource(tp.t1, tp.t1Building);
  addResource(tp.t2, tp.t2Building);
  addResource(tp.t3, tp.t3Building);

  return targets;
}

// ── Planner ───────────────────────────────────────────────────────────

/**
 * Calculate production cycles for all producible resources this tick, unified with building affordability.
 *
 * Buildings are evaluated first and their costs deducted from the shared budget before
 * production is planned, ensuring buildings always get priority on shared resources.
 *
 * @param balances - Current resource balances (resource ID → human-readable amount).
 * @param buildingCounts - Map of BuildingType → count on the realm.
 * @param troopPath - Troop path this realm follows; determines T2/T3 resource targets.
 * @param gameConfig - On-chain game configuration with resource recipes and factory data.
 * @param tickSeconds - Tick interval in seconds; reserved for future rate calculations (default 60).
 * @param isVillage - Whether this is a village structure; reserved for future rate scaling.
 * @param buildingTargets - Candidate buildings to evaluate for affordability against the shared budget.
 * @returns A UnifiedPlan listing production calls, affordable/skipped builds, and budget tracking maps.
 */
export function planProduction(
  balances: Map<number, number>,
  buildingCounts: Map<number, number>,
  troopPath: TroopPath,
  gameConfig: GameConfig,
  tickSeconds: number = 60,
  isVillage: boolean = false,
  buildingTargets: BuildingTarget[] = [],
): UnifiedPlan {
  const targets = resolveTargets(troopPath, buildingCounts, gameConfig);
  // Try optimal (recipe-driven) weights first; fall back to fixed smart weights
  const optimalWeights = computeOptimalWeights(balances, buildingCounts, troopPath, gameConfig);
  const smartWeights = optimalWeights ?? computeSmartWeights(buildingCounts, troopPath);

  // Budget = 90% of each resource's balance (same cap as game client).
  // Buildings are evaluated first and consume from this budget before production.
  // Labor reserve is applied AFTER buildings, not before — so buildings can
  // always access the full Labor balance for construction.
  const budget = new Map<number, number>();
  for (const [resourceId, amount] of balances) {
    budget.set(resourceId, Math.max(0, Math.floor((amount * 90) / 100)));
  }

  const calls: ProductionCall[] = [];
  const consumed = new Map<number, number>();
  const produced = new Map<number, number>();
  const skipped: Array<{ resourceId: number; reason: string }> = [];

  // Process buildings first — they consume exact costs from shared budget
  const affordableBuilds: BuildingTarget[] = [];
  const skippedBuilds: Array<{ label: string; reason: string }> = [];

  for (const bt of buildingTargets) {
    let canAfford = true;
    for (const cost of bt.costs) {
      const remaining = budget.get(cost.resource) ?? 0;
      if (remaining < cost.amount) {
        canAfford = false;
        break;
      }
    }
    if (canAfford) {
      for (const cost of bt.costs) {
        budget.set(cost.resource, (budget.get(cost.resource) ?? 0) - cost.amount);
        consumed.set(cost.resource, (consumed.get(cost.resource) ?? 0) + cost.amount);
      }
      affordableBuilds.push(bt);
    } else {
      skippedBuilds.push({ label: bt.label, reason: "Insufficient budget" });
    }
  }

  // Apply Labor reserve AFTER buildings — buildings get full access to Labor
  // for construction, but production shouldn't drain it below the reserve.
  const LABOR_ID = 23;
  const LABOR_RESERVE = 800;
  const laborBudget = budget.get(LABOR_ID) ?? 0;
  if (laborBudget > 0) {
    budget.set(LABOR_ID, Math.max(0, laborBudget - LABOR_RESERVE));
  }

  for (const target of targets) {
    const factory = gameConfig.resourceFactories[target.resourceId];
    if (!factory) {
      skipped.push({ resourceId: target.resourceId, reason: "No factory config" });
      continue;
    }

    const inputs = target.method === "complex" ? factory.complexInputs : factory.simpleInputs;
    const outputPerCycle = target.method === "complex" ? factory.outputPerComplexInput : factory.outputPerSimpleInput;

    if (inputs.length === 0 || outputPerCycle <= 0) {
      skipped.push({ resourceId: target.resourceId, reason: `No ${target.method} recipe` });
      continue;
    }

    // Get the weight for this target
    const targetWeight = smartWeights.get(target.resourceId);
    const weightPercent = targetWeight
      ? target.method === "simple"
        ? targetWeight.laborToResource
        : targetWeight.resourceToResource
      : 0;

    // Skip if weight is 0
    if (weightPercent <= 0) {
      skipped.push({ resourceId: target.resourceId, reason: `Zero weight for ${target.method}` });
      continue;
    }

    // Affordability: use weight% of each input's total balance as the limit,
    // further constrained by remaining shared budget.
    let affordableCycles = Infinity;
    for (const input of inputs) {
      if (input.amount <= 0) continue;
      const remaining = budget.get(input.resource) ?? 0;
      if (remaining <= 0) {
        affordableCycles = 0;
        break;
      }
      const totalForInput = balances.get(input.resource) ?? 0;
      const weightedLimit = Math.floor((totalForInput * weightPercent) / 100);
      const permitted = Math.min(remaining, weightedLimit);
      affordableCycles = Math.min(affordableCycles, Math.floor(permitted / input.amount));
    }

    const cycles = Number.isFinite(affordableCycles) ? affordableCycles : 0;

    if (cycles <= 0) {
      skipped.push({ resourceId: target.resourceId, reason: `Insufficient ${target.method} inputs` });
      continue;
    }

    // Consume inputs from budget
    for (const input of inputs) {
      const cost = input.amount * cycles;
      budget.set(input.resource, (budget.get(input.resource) ?? 0) - cost);
      consumed.set(input.resource, (consumed.get(input.resource) ?? 0) + cost);
    }

    const amount = outputPerCycle * cycles;
    produced.set(target.resourceId, (produced.get(target.resourceId) ?? 0) + amount);
    calls.push({ resourceId: target.resourceId, cycles, produced: amount, method: target.method });
  }

  return { calls, consumed, produced, skipped, affordableBuilds, skippedBuilds };
}

// ── Smart weight computation ────────────────────────────────────────

interface SmartWeight {
  resourceToResource: number;
  laborToResource: number;
}

// T1 resource building types
const T1_BUILDING_TYPES = [
  R.Wood + RESOURCE_TO_BUILDING_OFFSET, // 5
  R.Coal + RESOURCE_TO_BUILDING_OFFSET, // 4
  R.Copper + RESOURCE_TO_BUILDING_OFFSET, // 6
];

// T1 resource IDs
const T1_RESOURCE_IDS = [R.Wood, R.Coal, R.Copper];

// Donkey building type
const DONKEY_BUILDING = R.Donkey + RESOURCE_TO_BUILDING_OFFSET; // 27

/**
 * Compute smart production weights based on the realm's development stage.
 *
 * Weights determine what percentage of each resource's balance to allocate
 * to production. Stage is inferred from which buildings exist.
 *
 * @param buildingCounts - Map of BuildingType → count on the realm.
 * @param troopPath - Troop path this realm follows.
 * @returns Map of resource ID → SmartWeight.
 */
export function computeSmartWeights(
  buildingCounts: Map<number, number>,
  troopPath: TroopPath,
): Map<number, SmartWeight> {
  const weights = new Map<number, SmartWeight>();
  const tp = TROOP_PATHS[troopPath];

  function has(buildingType: number): boolean {
    return (buildingCounts.get(buildingType) ?? 0) > 0;
  }

  // Count distinct T1 resource building types present
  const t1Present = T1_BUILDING_TYPES.filter((bt) => has(bt));
  const t1Complete = t1Present.length >= 3;

  // Check for higher-tier buildings (T2/T3 resources or any troop building)
  const higherTierBuildings = [
    tp.t2Resource + RESOURCE_TO_BUILDING_OFFSET,
    tp.t3Resource + RESOURCE_TO_BUILDING_OFFSET,
    tp.t1Building,
    tp.t2Building,
    tp.t3Building,
  ];
  const hasHigherTiers = higherTierBuildings.some((bt) => has(bt));

  // ── T1 Resources ──
  if (!t1Complete) {
    // T1 incomplete: labor-only at 5%
    for (let i = 0; i < T1_RESOURCE_IDS.length; i++) {
      if (has(T1_BUILDING_TYPES[i])) {
        weights.set(T1_RESOURCE_IDS[i], { resourceToResource: 0, laborToResource: 5 });
      }
    }
  } else if (!hasHigherTiers) {
    // T1 complete only: 30% resource + 10% labor (grow the pool)
    for (let i = 0; i < T1_RESOURCE_IDS.length; i++) {
      if (has(T1_BUILDING_TYPES[i])) {
        weights.set(T1_RESOURCE_IDS[i], { resourceToResource: 30, laborToResource: 10 });
      }
    }
  } else {
    // T1 + higher tiers: Wood=20, Coal=20, Copper=30 + 10% labor each
    const t1Weights = [20, 20, 30]; // Wood, Coal, Copper
    for (let i = 0; i < T1_RESOURCE_IDS.length; i++) {
      if (has(T1_BUILDING_TYPES[i])) {
        weights.set(T1_RESOURCE_IDS[i], { resourceToResource: t1Weights[i], laborToResource: 10 });
      }
    }
  }

  // ── Donkey ──
  if (has(DONKEY_BUILDING)) {
    weights.set(R.Donkey, { resourceToResource: 10, laborToResource: 10 });
  }

  // ── T2/T3 Resources ──
  if (hasHigherTiers) {
    const t2ResBldg = tp.t2Resource + RESOURCE_TO_BUILDING_OFFSET;
    if (has(t2ResBldg)) {
      weights.set(tp.t2Resource, { resourceToResource: 10, laborToResource: 10 });
    }
    const t3ResBldg = tp.t3Resource + RESOURCE_TO_BUILDING_OFFSET;
    if (has(t3ResBldg)) {
      weights.set(tp.t3Resource, { resourceToResource: 10, laborToResource: 10 });
    }
  }

  // ── Troops ──
  const hasT1Troop = has(tp.t1Building);
  const hasT2Troop = has(tp.t2Building);
  const hasT3Troop = has(tp.t3Building);

  if (hasT3Troop) {
    // T3 exists: T3=50%, T2=30%, T1=10% + 10% labor each
    weights.set(tp.t3, { resourceToResource: 50, laborToResource: 10 });
    if (hasT2Troop) weights.set(tp.t2, { resourceToResource: 30, laborToResource: 10 });
    if (hasT1Troop) weights.set(tp.t1, { resourceToResource: 10, laborToResource: 10 });
  } else if (hasT2Troop) {
    // T2 exists: T2=30%, T1=10% + 10% labor each
    weights.set(tp.t2, { resourceToResource: 30, laborToResource: 10 });
    if (hasT1Troop) weights.set(tp.t1, { resourceToResource: 10, laborToResource: 10 });
  } else if (hasT1Troop) {
    // T1 only: 30% + 10% labor
    weights.set(tp.t1, { resourceToResource: 30, laborToResource: 10 });
  }

  return weights;
}

// ── Optimal weight computation (recipe-driven) ─────────────────────

/**
 * Walk the recipe tree from a target resource, computing total demand
 * for each input resource per 1 unit of target output.
 *
 * Handles self-referencing recipes and circular dependencies by tracking
 * visited nodes. Only follows complex (resource-to-resource) recipes.
 */
function computeTotalDemand(
  targetId: number,
  gameConfig: GameConfig,
): Map<number, number> {
  const demand = new Map<number, number>();

  function walk(resourceId: number, multiplier: number, visited: Set<number>) {
    const factory = gameConfig.resourceFactories[resourceId];
    if (!factory || factory.complexInputs.length === 0) return;

    const output = factory.outputPerComplexInput;
    if (output <= 0) return;

    for (const input of factory.complexInputs) {
      // Skip self-referencing inputs (some recipes consume their own output)
      if (input.resource === resourceId) continue;
      // Skip already-visited to prevent infinite loops in circular recipes
      if (visited.has(input.resource)) continue;

      const neededPerUnit = (input.amount / output) * multiplier;
      demand.set(input.resource, (demand.get(input.resource) ?? 0) + neededPerUnit);

      // Recurse into the input's recipe
      walk(input.resource, neededPerUnit, new Set([...visited, resourceId]));
    }
  }

  walk(targetId, 1, new Set());
  return demand;
}

/**
 * Compute production weights by walking the recipe tree backwards from
 * the highest-tier troop the realm can produce.
 *
 * Instead of fixed percentages, weights are proportional to each resource's
 * "deficit" — how far its current balance is from the ideal ratio needed
 * to produce the target troop. Bottleneck resources get higher weights.
 *
 * Falls back to null if the realm has no troop buildings (caller should
 * use computeSmartWeights instead).
 *
 * @param balances - Current resource balances (resource ID → human amount).
 * @param buildingCounts - Map of BuildingType → count on the realm.
 * @param troopPath - Troop path this realm follows.
 * @param gameConfig - On-chain game configuration with resource recipes.
 * @returns Optimal weights, or null if no troop buildings exist.
 */
export function computeOptimalWeights(
  balances: Map<number, number>,
  buildingCounts: Map<number, number>,
  troopPath: TroopPath,
  gameConfig: GameConfig,
): Map<number, SmartWeight> | null {
  const tp = TROOP_PATHS[troopPath];
  const has = (bt: number) => (buildingCounts.get(bt) ?? 0) > 0;
  const bal = (r: number) => balances.get(r) ?? 0;

  // Find target: highest tier troop with a building.
  // If Essence is required but absent, downgrade to a tier that doesn't need it.
  let targetId: number | null = null;

  if (has(tp.t3Building) && bal(38) > 0) {
    targetId = tp.t3;
  } else if (has(tp.t2Building) && bal(38) > 0) {
    targetId = tp.t2;
  } else if (has(tp.t1Building)) {
    targetId = tp.t1;
  }

  if (targetId === null) return null; // no troop buildings → fallback

  // Walk the recipe tree to find total demand per cycle of target
  const demand = computeTotalDemand(targetId, gameConfig);

  if (demand.size === 0) return null; // no recipe data → fallback

  // For each resource in demand, compute "sustain cycles" = balance / demandPerCycle.
  // Resources that sustain fewer cycles are the bottleneck and need more weight.
  const sustainInfo: Array<{ resourceId: number; cycles: number; hasBuilding: boolean }> = [];

  for (const [resourceId, demandPerCycle] of demand) {
    if (demandPerCycle <= 0) continue;

    // Check if we have a building for this resource
    // Resource buildings: resourceId + 2. Troop buildings: use TROOP_PATHS lookup.
    const resBuildingType = resourceId + RESOURCE_TO_BUILDING_OFFSET;
    const isTroop =
      resourceId === tp.t1 || resourceId === tp.t2 || resourceId === tp.t3;
    const troopBuildingType = isTroop
      ? resourceId === tp.t1 ? tp.t1Building
        : resourceId === tp.t2 ? tp.t2Building
        : tp.t3Building
      : -1;
    const hasBuilding = has(resBuildingType) || has(troopBuildingType);

    // Non-producible resources (like Essence) are constraints, not targets
    // Skip them — they can't be produced so weighting them is pointless
    if (!hasBuilding) continue;

    const cycles = bal(resourceId) / demandPerCycle;
    sustainInfo.push({ resourceId, cycles, hasBuilding });
  }

  if (sustainInfo.length === 0) return null;

  // Compute weights: inverse of sustain cycles (fewer cycles = more deficit = more weight)
  let totalInverse = 0;
  const inverses = new Map<number, number>();

  for (const { resourceId, cycles } of sustainInfo) {
    const inverse = 1 / (cycles + 1); // +1 to avoid div-by-zero
    inverses.set(resourceId, inverse);
    totalInverse += inverse;
  }

  const weights = new Map<number, SmartWeight>();
  const MIN_WEIGHT = 5;
  const MAX_WEIGHT = 50;

  // If Labor is below 800, stop burning it for production so it can
  // accumulate for building construction and realm upgrades.
  const laborBalance = bal(23); // Labor = resource 23
  const laborFloor = laborBalance < 800 ? 0 : 10;

  for (const [resourceId, inverse] of inverses) {
    const proportion = totalInverse > 0 ? inverse / totalInverse : 0;
    const rawWeight = Math.round(proportion * 80); // 80% total budget for complex
    const weight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, rawWeight));
    weights.set(resourceId, { resourceToResource: weight, laborToResource: laborFloor });
  }

  // Ensure the target troop and any intermediate troop tiers get weights.
  // The demand tree only contains INPUTS to the target, not the target itself.
  // Without this, troop production gets zero weight and is skipped.
  if (has(tp.t1Building) && !weights.has(tp.t1)) {
    weights.set(tp.t1, { resourceToResource: 30, laborToResource: laborFloor });
  }
  if (has(tp.t2Building) && !weights.has(tp.t2)) {
    weights.set(tp.t2, { resourceToResource: 30, laborToResource: laborFloor });
  }
  if (has(tp.t3Building) && !weights.has(tp.t3)) {
    weights.set(tp.t3, { resourceToResource: 50, laborToResource: laborFloor });
  }

  // Ensure T2/T3 resource buildings get weights even if they're not in the
  // current target's demand tree. These resources are needed for building
  // T2/T3 barracks and for higher-tier troop production once barracks exist.
  // Without this, Gold/Ironwood/ColdIron/Mithral/Adamantine/Dragonhide never
  // accumulate and T2/T3 barracks can never be afforded.
  const t2ResBldg = tp.t2Resource + RESOURCE_TO_BUILDING_OFFSET;
  if (has(t2ResBldg) && !weights.has(tp.t2Resource)) {
    weights.set(tp.t2Resource, { resourceToResource: 10, laborToResource: laborFloor });
  }
  const t3ResBldg = tp.t3Resource + RESOURCE_TO_BUILDING_OFFSET;
  if (has(t3ResBldg) && !weights.has(tp.t3Resource)) {
    weights.set(tp.t3Resource, { resourceToResource: 10, laborToResource: laborFloor });
  }

  // Ensure donkey always gets a small allocation if building exists
  if (has(DONKEY_BUILDING) && !weights.has(R.Donkey)) {
    weights.set(R.Donkey, { resourceToResource: 5, laborToResource: laborFloor });
  }

  return weights;
}
