import {
  buildExecutionSummary,
  buildRealmProductionPlan,
  planHasExecutableCalls,
  PROCESS_INTERVAL_MS,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import { useAutomationStore } from "./store/use-automation-store";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { getStructureName, getIsBlitz } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Account as StarknetAccount } from "starknet";

const resolveResourceLabel = (resourceId: number): string => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : `Resource ${resourceId}`;
};

export const useAutomation = () => {
  const {
    setup: {
      systemCalls: { execute_realm_production_plan },
      components,
    },
    account: { account: starknetSignerAccount },
  } = useDojo();

  const realms = useAutomationStore((state) => state.realms);
  const setNextRunTimestamp = useAutomationStore((state) => state.setNextRunTimestamp);
  const recordExecution = useAutomationStore((state) => state.recordExecution);
  const ensureResourceConfig = useAutomationStore((state) => state.ensureResourceConfig);
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const processingRef = useRef(false);
  const processRealmsRef = useRef<() => Promise<boolean>>(async () => false);
  const setNextRunTimestampRef = useRef(setNextRunTimestamp);
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const realmResourcesSignatureRef = useRef<string>("");

  useEffect(() => {
    const blitzMode = getIsBlitz();
    playerRealms.forEach((realm) => {
      upsertRealm(String(realm.entityId), {
        realmName: getStructureName(realm.structure, blitzMode).name,
        entityType: "realm",
      });
    });
    playerVillages.forEach((village) => {
      upsertRealm(String(village.entityId), {
        realmName: getStructureName(village.structure, blitzMode).name,
        entityType: "village",
      });
    });
  }, [playerRealms, playerVillages, upsertRealm]);

  const processRealms = useCallback(async (): Promise<boolean> => {
    if (processingRef.current) return false;

    if (!starknetSignerAccount || !starknetSignerAccount.address || starknetSignerAccount.address === "0x0") {
      console.warn("Automation: Missing Starknet signer. Skipping automation pass.");
      return false;
    }

    if (!components) {
      console.warn("Automation: Missing Dojo components. Skipping automation pass.");
      return false;
    }

    const realmList = Object.values(realms);
    if (realmList.length === 0) {
      return false;
    }

    processingRef.current = true;
    let anyExecuted = false;

    try {
      for (const realmConfig of realmList) {
        const plan = buildRealmProductionPlan({ realmConfig, components });

        plan.evaluatedResourceIds.forEach((resourceId) => {
          ensureResourceConfig(realmConfig.realmId, resourceId);
        });
        if (!planHasExecutableCalls(plan)) {
          console.debug("[Automation] Skipping execution (no executable calls)", {
            realmId: realmConfig.realmId,
            realmName: realmConfig.realmName,
            entityType: realmConfig.entityType,
            configuredResources: Object.keys(realmConfig.resources ?? {}).length,
            evaluatedResourceIds: plan.evaluatedResourceIds,
            callset: plan.callset,
            skipped: plan.skipped,
          });
          continue;
        }

        console.debug("[Automation] Executing automation plan", {
          realmId: realmConfig.realmId,
          realmName: realmConfig.realmName,
          entityType: realmConfig.entityType,
          callset: plan.callset,
          consumptionByResource: plan.consumptionByResource,
          outputsByResource: plan.outputsByResource,
        });

        try {
          const callset = plan.callset;
          await execute_realm_production_plan({
            signer: starknetSignerAccount as StarknetAccount,
            realm_entity_id: plan.realmId,
            resource_to_resource: callset.resourceToResource.map((item) => ({
              resource_id: item.resourceId,
              cycles: item.cycles,
            })),
            labor_to_resource: callset.laborToResource.map((item) => ({
              resource_id: item.resourceId,
              cycles: item.cycles,
            })),
          });

          const summary = buildExecutionSummary(plan, Date.now());
          recordExecution(realmConfig.realmId, summary);
          anyExecuted = true;

          const producedResources = Object.entries(plan.outputsByResource);
          if (producedResources.length > 0) {
            const detail = producedResources
              .map(([resId, amount]) => {
                const label = resolveResourceLabel(Number(resId));
                return `${Math.round(amount).toLocaleString()} ${label}`;
              })
              .join(", ");
            toast.success(`Automation executed for ${realmConfig.realmName ?? `Realm ${plan.realmId}`}: ${detail}`);
          } else {
            toast.success(`Automation executed for ${realmConfig.realmName ?? `Realm ${plan.realmId}`}.`);
          }
        } catch (error) {
          console.error(`Automation: Failed to execute plan for realm ${realmConfig.realmId}`, error);
          toast.error(`Automation failed for ${realmConfig.realmName ?? realmConfig.realmId}. Check console for details.`);
        }
      }
    } finally {
      processingRef.current = false;
    }

    return anyExecuted;
  }, [components, realms, execute_realm_production_plan, recordExecution, ensureResourceConfig, starknetSignerAccount]);

  useEffect(() => {
    processRealmsRef.current = processRealms;
  }, [processRealms]);

  useEffect(() => {
    setNextRunTimestampRef.current = setNextRunTimestamp;
  }, [setNextRunTimestamp]);

  useEffect(() => {
    const signature = Object.entries(realms)
      .map(([realmId, realm]) => {
        const resourceKeys = Object.keys(realm.resources ?? {}).sort().join(",");
        return `${realmId}:${resourceKeys}`;
      })
      .sort()
      .join("|");

    if (signature !== realmResourcesSignatureRef.current) {
      realmResourcesSignatureRef.current = signature;
      void processRealmsRef.current();
    }
  }, [realms]);

  useEffect(() => {
    const runAutomation = async () => {
      const processed = await processRealmsRef.current();
      if (processed) {
        setNextRunTimestampRef.current(Date.now() + PROCESS_INTERVAL_MS);
      }
    };

    runAutomation();
    const intervalId = window.setInterval(runAutomation, PROCESS_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);
};
