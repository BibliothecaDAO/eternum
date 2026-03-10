import type { EternumProvider } from "@bibliothecadao/provider";
import type { SlotResult } from "./placement.js";
import type { BuildStep } from "./build-order.js";

export interface BuildAction {
  step: BuildStep;
  slot: SlotResult;
  useSimple: boolean;
}

export interface UpgradeAction {
  fromLevel: number;
  fromName: string;
  toName: string;
}

export interface ProductionActions {
  resourceToResource: Array<{ resource_id: number; cycles: number }>;
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

export interface TickResult {
  realmEntityId: number;
  built: string[];
  upgraded: string | null;
  produced: boolean;
  idle: boolean;
  errors: string[];
}

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

  // Production runs independently (no population impact).
  const productionJob = (input.productionCalls &&
    (input.productionCalls.resourceToResource.length > 0 || input.productionCalls.laborToResource.length > 0))
    ? provider
        .execute_realm_production_plan({
          realm_entity_id: realmEntityId,
          resource_to_resource: input.productionCalls.resourceToResource,
          labor_to_resource: input.productionCalls.laborToResource,
          signer,
        })
        .then(() => {
          result.produced = true;
          result.idle = false;
        })
        .catch((e: any) => {
          result.errors.push(`Production failed: ${e.message ?? e}`);
        })
    : Promise.resolve();

  // Buildings must run sequentially — each one changes population,
  // and parallel execution causes "Population exceeds capacity" errors
  // because each tx validates against the same pre-build state.
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

  // Wait for production to finish (it was running in parallel with builds)
  await productionJob;

  return result;
}
