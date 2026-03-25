/**
 * Automation runner — dry-run planning only, no transaction execution.
 *
 * Each tick, inspects the realm's buildings and level, walks the biome-driven
 * build order in a repeating cycle, checks slot availability and population
 * capacity, and returns all actionable builds for this tick (not just one).
 * The executor handles actual on-chain submission.
 */

import { type BuildOrder, type BuildStep, buildOrderForBiome } from "./build-order.js";

// ── Realm level → max building slots ──────────────────────────────────

/** Realm level (0-indexed) to maximum building slot count. */
const LEVEL_SLOTS: Record<number, number> = {
  0: 6, // Settlement
  1: 18, // City
  2: 36, // Kingdom
  3: 60, // Empire
};

/** Realm level to human-readable name for log output. */
const LEVEL_NAMES: Record<number, string> = {
  0: "Settlement",
  1: "City",
  2: "Kingdom",
  3: "Empire",
};

/** BuildingType ID for WorkersHut, used when auto-injecting population buildings. */
const WORKERS_HUT = 1;

// ── Input / Output types ──────────────────────────────────────────────

/**
 * Population impact of a single building instance.
 * Used by the runner to decide when to inject WorkersHuts.
 */
export interface BuildingPopulationInfo {
  /** How much population capacity this building consumes when placed. */
  populationCost: number;
  /** How much additional population capacity this building provides (e.g. WorkersHut). */
  capacityGrant: number;
}

/** Snapshot of the realm's current state, consumed by the automation runner each tick. */
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

/** A single building the runner intends to place this tick. */
interface BuildIntent {
  /** The build-order step being fulfilled. */
  step: BuildStep;
  /** Position within the (possibly multi-pass) build-order walk. */
  index: number;
  /** True when this is an auto-injected WorkersHut to satisfy population demand. */
  injectedForPopulation?: boolean;
}

/** Signal that the realm should be upgraded to unlock more building slots. */
interface UpgradeIntent {
  /** Current realm level (0-based). */
  fromLevel: number;
  /** Human-readable name of the current level (e.g. "City"). */
  fromName: string;
  /** Human-readable name of the next level (e.g. "Kingdom"). */
  toName: string;
}

/**
 * The complete output of a single automation tick.
 * Exactly one of `builds`, `upgrade`, or `idle` will be the "primary" action.
 */
interface AutomationPlan {
  /** Ordered list of buildings to place this tick (may include auto-injected WorkersHuts). */
  builds: BuildIntent[];
  /** Non-null when the build order is blocked by slot capacity and a realm upgrade is needed. */
  upgrade: UpgradeIntent | null;
  /** Non-null with a human-readable reason when nothing can be built (e.g. "Build order complete"). */
  idle: string | null;
}

// ── Runner ────────────────────────────────────────────────────────────

/**
 * Determine all automation actions for a realm this tick.
 *
 * Cycles the build order, collecting every building that fits within
 * available slots and population capacity. Injects WorkersHuts when
 * population is the bottleneck. Returns an upgrade intent if slots
 * run out and more buildings are needed.
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
 * automatically when population is the bottleneck. Signals an upgrade intent
 * when slots are exhausted and more buildings are still needed.
 *
 * @param order - The explicit build order to walk (use {@link buildOrderForBiome} to derive it).
 * @param state - Current realm state (level, building counts).
 * @param populationInfo - Population cost and capacity grant keyed by BuildingType.
 * @returns An AutomationPlan with the full build list, an optional upgrade intent, and an idle reason.
 */
export function resolvePlan(
  order: BuildOrder,
  state: RealmState,
  populationInfo: Record<number, BuildingPopulationInfo>,
): AutomationPlan {
  const claimed = new Map<number, number>();
  const maxSlots = LEVEL_SLOTS[state.level] ?? 6;
  let slotsUsed = sumValues(state.buildingCounts);

  // Compute current population used and capacity from ALL buildings.
  // Realms start with a base capacity of 6 before any WorkersHuts.
  let popUsed = 0;
  let popCapacity = 6;
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

      // 1. Does this step require a higher realm level?
      if (step.minLevel > state.level) {
        if (state.level >= 3) {
          return { builds, upgrade: null, idle: builds.length === 0 ? "Empire (max level)" : null };
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

      // 2. Do we have a slot?
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
          step: { building: WORKERS_HUT, label: "WorkersHut", minLevel: 0 },
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
