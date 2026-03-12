/**
 * Realm tick executor — submits on-chain transactions for a single automation cycle.
 *
 * Handles buildings, upgrades, and production in a fixed priority order to prevent
 * resource costs from being double-spent across concurrent operations.
 */
import type { EternumProvider } from "@bibliothecadao/provider";
import type { SlotResult } from "./placement.js";
import type { BuildStep } from "./build-order.js";

/** A single building construction action to be submitted on-chain. */
export interface BuildAction {
  /** The build-order step describing which building to construct. */
  step: BuildStep;
  /** The hex slot where the building will be placed. */
  slot: SlotResult;
  /** Whether to use the simple (labor-only) recipe instead of the complex one. */
  useSimple: boolean;
}

/** Intent to upgrade a realm from one level to the next. */
export interface UpgradeAction {
  /** Current realm level (0-indexed). */
  fromLevel: number;
  /** Human-readable name of the current level (e.g. "Settlement"). */
  fromName: string;
  /** Human-readable name of the target level (e.g. "City"). */
  toName: string;
}

/** Batched production calls to submit in a single transaction. */
export interface ProductionActions {
  /** Complex (resource-to-resource) production cycles, keyed by resource ID. */
  resourceToResource: Array<{ resource_id: number; cycles: number }>;
  /** Simple (labor-to-resource) production cycles, keyed by resource ID. */
  laborToResource: Array<{ resource_id: number; cycles: number }>;
}

interface TickInput {
  provider: EternumProvider;
  signer: any;
  realmEntityId: number;
  buildActions: BuildAction[];
  upgradeIntent: UpgradeAction | null;
  productionCalls: ProductionActions | null;
}

/** Summary of all actions taken (or attempted) during a single realm tick. */
export interface TickResult {
  /** Entity ID of the realm that was ticked. */
  realmEntityId: number;
  /** Labels of buildings successfully constructed this tick. */
  built: string[];
  /** Human-readable upgrade string (e.g. "Settlement → City"), or null if no upgrade occurred. */
  upgraded: string | null;
  /** Whether production was executed this tick. */
  produced: boolean;
  /** True when no actions were taken (nothing to build, upgrade, or produce). */
  idle: boolean;
  /** Error messages from any failed transactions. */
  errors: string[];
}

/**
 * Execute all automation actions for a single realm in one tick.
 *
 * Buildings run first (sequentially), then the upgrade, then production.
 * A failed build halts subsequent builds to prevent cascading resource errors.
 *
 * @param input - Tick context: provider, signer, and all planned actions.
 * @returns A summary of what was built, upgraded, produced, and any errors.
 */
export async function executeRealmTick(input: TickInput): Promise<TickResult> {
  const { provider, signer, realmEntityId } = input;
  const result: TickResult = {
    realmEntityId,
    built: [],
    upgraded: null,
    produced: false,
    idle: true,
    errors: [],
  };

  // Buildings run first and sequentially — they consume resources and change
  // population. Running them before production ensures building costs aren't
  // eaten by parallel production burns.
  for (const build of input.buildActions) {
    try {
      await provider.create_building({
        entity_id: realmEntityId,
        directions: build.slot.directions,
        building_category: build.step.building,
        use_simple: build.useSimple,
        signer,
      });
      result.built.push(build.step.label);
      result.idle = false;
    } catch (e: any) {
      result.errors.push(`Build ${build.step.label} failed: ${e.message ?? e}`);
      // Stop building on first failure — subsequent builds may depend on
      // population capacity from this one (e.g., WorkersHut before troop building)
      break;
    }
  }

  if (input.upgradeIntent) {
    try {
      await provider.upgrade_realm({
        realm_entity_id: realmEntityId,
        signer,
      });
      result.upgraded = `${input.upgradeIntent!.fromName} \u2192 ${input.upgradeIntent!.toName}`;
      result.idle = false;
    } catch (e: any) {
      result.errors.push(`Upgrade failed: ${e.message ?? e}`);
    }
  }

  // Production runs after buildings complete — buildings get priority
  // on shared resources to avoid "Insufficient Balance" errors.
  if (input.productionCalls) {
    const { resourceToResource, laborToResource } = input.productionCalls;
    if (resourceToResource.length > 0 || laborToResource.length > 0) {
      try {
        await provider.execute_realm_production_plan({
          realm_entity_id: realmEntityId,
          resource_to_resource: resourceToResource,
          labor_to_resource: laborToResource,
          signer,
        });
        result.produced = true;
        result.idle = false;
      } catch (e: any) {
        result.errors.push(`Production failed: ${e.message ?? e}`);
      }
    }
  }

  return result;
}
