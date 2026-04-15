import type { RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import type { ExecuteRealmProductionPlanProps } from "@bibliothecadao/types";
import type { RealmProductionPlan } from "./automation-processor";

export interface ExecutableProductionPlan {
  plan: RealmProductionPlan;
  realmConfig: RealmAutomationConfig;
  realmLabel: string;
  planLogPayload: Record<string, unknown>;
}

type ExecuteRealmProductionPlan = (args: ExecuteRealmProductionPlanProps) => Promise<unknown>;

type ProductionPlanExecutionResult =
  | { status: "fulfilled"; value: ExecutableProductionPlan }
  | {
      status: "rejected";
      reason: {
        error: unknown;
        realmConfig: RealmAutomationConfig;
        realmLabel: string;
      };
    };

export const executeProductionPlansSequentially = async ({
  executablePlans,
  signer,
  executeRealmProductionPlan,
  onBeforeExecute,
}: {
  executablePlans: ExecutableProductionPlan[];
  signer: ExecuteRealmProductionPlanProps["signer"];
  executeRealmProductionPlan: ExecuteRealmProductionPlan;
  onBeforeExecute?: (executablePlan: ExecutableProductionPlan) => void;
}): Promise<ProductionPlanExecutionResult[]> => {
  const results: ProductionPlanExecutionResult[] = [];

  for (const executablePlan of executablePlans) {
    const { plan, realmConfig, realmLabel } = executablePlan;

    try {
      onBeforeExecute?.(executablePlan);
      const callset = plan.callset;
      await executeRealmProductionPlan({
        signer,
        realm_entity_id: plan.realmId,
        skipQueue: true,
        resource_to_resource: callset.resourceToResource.map((item) => ({
          resource_id: item.resourceId,
          cycles: item.cycles,
        })),
        labor_to_resource: callset.laborToResource.map((item) => ({
          resource_id: item.resourceId,
          cycles: item.cycles,
        })),
      });
      results.push({ status: "fulfilled", value: executablePlan });
    } catch (error) {
      results.push({
        status: "rejected",
        reason: {
          error,
          realmConfig,
          realmLabel,
        },
      });
    }
  }

  return results;
};
