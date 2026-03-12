/**
 * Automation runner — dry-run only.
 *
 * Each tick, the runner inspects the realm's current buildings and level,
 * walks the biome-driven build order in a repeating cycle, checks both
 * slot availability AND population capacity, and returns ALL actions
 * that can be taken this tick (not just one).
 * It does NOT execute transactions.
 */

import { type BuildOrder, type BuildStep, buildOrderForBiome } from "./build-order.js";

// ── Realm level → max building slots ──────────────────────────────────

// On-chain levels are 0-indexed: 0=Settlement, 1=City, 2=Kingdom, 3=Empire
const LEVEL_SLOTS: Record<number, number> = {
  0: 6, // Settlement
  1: 18, // City
  2: 36, // Kingdom
  3: 60, // Empire
};

const LEVEL_NAMES: Record<number, string> = {
  0: "Settlement",
  1: "City",
  2: "Kingdom",
  3: "Empire",
};

const WORKERS_HUT = 1;

// ── Input / Output types ──────────────────────────────────────────────

/** Population impact of a single building instance. */
export interface BuildingPopulationInfo {
  /** How much population capacity this building consumes when placed. */
  populationCost: number;
  /** How much additional population capacity this building provides (e.g. WorkersHut). */
  capacityGrant: number;
}

export interface RealmState {
  /** Biome of the realm's home tile (drives troop path selection). */
  biome: number;
  /** Realm level: 0=Settlement, 1=City, 2=Kingdom, 3=Empire. */
  level: number;
  /**
   * Count of each building type currently on the realm.
   * Keyed by BuildingType numeric value.
   */
  buildingCounts: Map<number, number>;
}

interface BuildIntent {
  step: BuildStep;
  index: number;
  /** True if this WH was injected for population — paired with the next build. */
  injectedForPopulation?: boolean;
}

interface UpgradeIntent {
  fromLevel: number;
  fromName: string;
  toName: string;
}

interface AutomationPlan {
  builds: BuildIntent[];
  upgrade: UpgradeIntent | null;
  idle: string | null;
}

// ── Runner ────────────────────────────────────────────────────────────

/**
 * Determine all automation actions for a realm this tick.
 *
 * Cycles the build order, collecting every building that can be placed
 * given available slots and population capacity. Injects WorkersHuts
 * when population is the bottleneck. Returns an upgrade intent if
 * slots run out and more buildings are needed.
 *
 * @param state - Current realm state (biome, level, building counts).
 * @param populationInfo - Population cost and capacity grant per BuildingType.
 * @returns An AutomationPlan listing builds to execute, an optional upgrade intent, and an idle reason.
 */
export function nextPlan(state: RealmState, populationInfo: Record<number, BuildingPopulationInfo>): AutomationPlan {
  const order = buildOrderForBiome(state.biome);
  return resolvePlan(order, state, populationInfo);
}

/**
 * Pure planning logic — separated from biome lookup for testability.
 *
 * Walks the build order in repeating cycles, collecting all builds that fit
 * within available slots and population capacity. WorkersHuts are injected
 * automatically when population is the bottleneck. Stops and signals an upgrade
 * intent when slots are exhausted and more buildings are still needed.
 *
 * @param order - The explicit build order to walk (use {@link buildOrderForBiome} to derive it).
 * @param state - Current realm state (level, building counts).
 * @param populationInfo - Population cost and capacity grant keyed by BuildingType.
 * @returns An AutomationPlan with the full list of builds, an optional upgrade intent, and an idle reason.
 */
export function resolvePlan(
  order: BuildOrder,
  state: RealmState,
  populationInfo: Record<number, BuildingPopulationInfo>,
): AutomationPlan {
  const claimed = new Map<number, number>();
  const maxSlots = LEVEL_SLOTS[state.level] ?? 6;
  let slotsUsed = sumValues(state.buildingCounts);

  // Compute current population used and capacity from ALL buildings
  let popUsed = 0;
  let popCapacity = 0;
  for (const [type, count] of state.buildingCounts) {
    const info = populationInfo[type];
    if (info) {
      popUsed += info.populationCost * count;
      popCapacity += info.capacityGrant * count;
    }
  }

  const builds: BuildIntent[] = [];
  const stepCount = order.steps.length;
  const maxPasses = Math.ceil(maxSlots / stepCount) + 1;

  for (let pass = 0; pass < maxPasses; pass++) {
    let foundUnsatisfied = false;

    for (let i = 0; i < stepCount; i++) {
      const step = order.steps[i];
      const built = state.buildingCounts.get(step.building) ?? 0;
      // Count how many we've already planned to build this tick
      const plannedForType = builds.filter((b) => b.step.building === step.building).length;
      const alreadyClaimed = claimed.get(step.building) ?? 0;

      if (built + plannedForType > alreadyClaimed) {
        // This step is satisfied by an existing or planned building
        claimed.set(step.building, alreadyClaimed + 1);
        continue;
      }

      foundUnsatisfied = true;
      const globalIndex = pass * stepCount + i;

      // 1. Do we have a slot?
      if (slotsUsed >= maxSlots) {
        if (state.level >= 3) {
          return { builds, upgrade: null, idle: builds.length === 0 ? "Empire (max level) — all slots full" : null };
        }
        return {
          builds,
          upgrade: {
            fromLevel: state.level,
            fromName: LEVEL_NAMES[state.level] ?? "Unknown",
            toName: LEVEL_NAMES[state.level + 1] ?? "Unknown",
          },
          idle: null,
        };
      }

      // 2. Do we have population allowance?
      const stepPopCost = populationInfo[step.building]?.populationCost ?? 0;
      if (stepPopCost > 0 && popUsed + stepPopCost > popCapacity) {
        // Need more population — inject a WorkersHut
        if (slotsUsed >= maxSlots) {
          // No room for WorkersHut either — upgrade
          if (state.level >= 3) {
            return {
              builds,
              upgrade: null,
              idle: builds.length === 0 ? "Empire — need population but no slots" : null,
            };
          }
          return {
            builds,
            upgrade: {
              fromLevel: state.level,
              fromName: LEVEL_NAMES[state.level] ?? "Unknown",
              toName: LEVEL_NAMES[state.level + 1] ?? "Unknown",
            },
            idle: null,
          };
        }

        builds.push({
          step: { building: WORKERS_HUT, label: "WorkersHut" },
          index: globalIndex,
          injectedForPopulation: true,
        });
        slotsUsed++;
        const whInfo = populationInfo[WORKERS_HUT];
        if (whInfo) {
          popUsed += whInfo.populationCost;
          popCapacity += whInfo.capacityGrant;
        }

        // Re-check if this step now fits after adding WorkersHut
        if (popUsed + stepPopCost > popCapacity) {
          // Still not enough — will get another WorkersHut on next iteration
          continue;
        }

        // Re-check slots — the WorkersHut consumed one
        if (slotsUsed >= maxSlots) {
          if (state.level >= 3) {
            return { builds, upgrade: null, idle: null };
          }
          return {
            builds,
            upgrade: {
              fromLevel: state.level,
              fromName: LEVEL_NAMES[state.level] ?? "Unknown",
              toName: LEVEL_NAMES[state.level + 1] ?? "Unknown",
            },
            idle: null,
          };
        }
      }

      // 3. Build it
      builds.push({ step, index: globalIndex });
      slotsUsed++;
      const buildInfo = populationInfo[step.building];
      if (buildInfo) {
        popUsed += buildInfo.populationCost;
        popCapacity += buildInfo.capacityGrant;
      }
      // Claim this step so subsequent passes see it as satisfied
      claimed.set(step.building, alreadyClaimed + 1);
    }

    if (!foundUnsatisfied) {
      continue;
    }
  }

  return { builds, upgrade: null, idle: builds.length === 0 ? "Build order complete" : null };
}

function sumValues(map: Map<number, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}
