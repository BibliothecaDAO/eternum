import type { EternumProvider } from "@bibliothecadao/provider";
import type { SlotResult } from "./placement.js";
import type { BuildStep } from "./build-order.js";

export interface BuildAction {
  action: "build";
  step: BuildStep;
  index: number;
  slot: SlotResult;
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

export interface TickInput {
  provider: EternumProvider;
  signer: any;
  realmEntityId: number;
  buildIntent: BuildAction | null;
  upgradeIntent: UpgradeAction | null;
  productionCalls: ProductionActions | null;
}

export interface TickResult {
  realmEntityId: number;
  built: string | null;
  upgraded: string | null;
  produced: boolean;
  idle: boolean;
  errors: string[];
}

export async function executeRealmTick(input: TickInput): Promise<TickResult> {
  const { provider, signer, realmEntityId } = input;
  const result: TickResult = {
    realmEntityId,
    built: null,
    upgraded: null,
    produced: false,
    idle: true,
    errors: [],
  };

  // Build
  if (input.buildIntent) {
    try {
      await provider.create_building({
        entity_id: realmEntityId,
        directions: input.buildIntent.slot.directions,
        building_category: input.buildIntent.step.building,
        use_simple: false,
        signer,
      });
      result.built = input.buildIntent.step.label;
      result.idle = false;
    } catch (e: any) {
      result.errors.push(`Build failed: ${e.message ?? e}`);
    }
  }

  // Upgrade
  if (input.upgradeIntent) {
    try {
      await provider.upgrade_realm({
        realm_entity_id: realmEntityId,
        signer,
      });
      result.upgraded = `${input.upgradeIntent.fromName} \u2192 ${input.upgradeIntent.toName}`;
      result.idle = false;
    } catch (e: any) {
      result.errors.push(`Upgrade failed: ${e.message ?? e}`);
    }
  }

  // Production
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
