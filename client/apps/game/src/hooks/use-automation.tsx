import {
  buildExecutionSummary,
  buildRealmProductionPlan,
  planHasExecutableCalls,
  PROCESS_INTERVAL_MS,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import { useAutomationStore } from "./store/use-automation-store";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { getStructureName, getIsBlitz, getBlockTimestamp } from "@bibliothecadao/eternum";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
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
  const removeRealm = useAutomationStore((state) => state.removeRealm);
  const processingRef = useRef(false);
  const processRealmsRef = useRef<() => Promise<boolean>>(async () => false);
  const setNextRunTimestampRef = useRef(setNextRunTimestamp);
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const realmResourcesSignatureRef = useRef<string>("");

  useEffect(() => {
    const blitzMode = getIsBlitz();
    const managedStructures = [...playerRealms, ...playerVillages];
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    console.log("[Automation] Sync managed structures", {
      realmCount: playerRealms.length,
      villageCount: playerVillages.length,
      total: managedStructures.length,
    });

    managedStructures.forEach((structure) => {
      const entityType = structure.structure?.category === StructureType.Village ? "village" : "realm";
      const name = getStructureName(structure.structure, blitzMode).name;

      console.log("[Automation] upsertRealm", {
        entityId: structure.entityId,
        entityType,
        name,
      });

      upsertRealm(String(structure.entityId), {
        realmName: name,
        entityType,
      });
    });

    Object.entries(useAutomationStore.getState().realms).forEach(([realmId, config]) => {
      const supportedType = config.entityType === "realm" || config.entityType === "village";
      if (!supportedType || !activeIds.has(realmId)) {
        console.log("[Automation] removeRealm", {
          realmId,
          entityType: config.entityType,
          supportedType,
          isActive: activeIds.has(realmId),
        });
        removeRealm(realmId);
      }
    });
  }, [playerRealms, playerVillages, removeRealm, upsertRealm]);

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

    const realmList = Object.values(realms).filter(
      (realm) => realm.entityType === "realm" || realm.entityType === "village",
    );
    console.log("[Automation] processRealms invoked", {
      timestamp: Date.now(),
      totalTrackedRealms: Object.keys(realms).length,
      activeRealmCount: realmList.length,
    });
    if (realmList.length === 0) {
      console.log("[Automation] No eligible realms found for automation run.");
      return false;
    }

    processingRef.current = true;
    let anyExecuted = false;

    try {
      const { currentDefaultTick } = getBlockTimestamp();
      console.log("[Automation] Using currentDefaultTick for planning", { currentDefaultTick });

      for (const realmConfig of realmList) {
        const plan = buildRealmProductionPlan({ realmConfig, components, currentTick: currentDefaultTick });

        plan.evaluatedResourceIds.forEach((resourceId) => {
          ensureResourceConfig(realmConfig.realmId, resourceId);
        });
        if (!planHasExecutableCalls(plan)) {
          console.log("[Automation] Skipping execution (no executable calls)", {
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

        console.log("[Automation] Executing automation plan", {
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
          console.log("[Automation] Execution complete", {
            realmId: realmConfig.realmId,
            executedAt: summary.executedAt,
            outputsByResource: summary.outputsByResource,
          });
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
      console.log("[Automation] processRealms finished", {
        executed: anyExecuted,
        timestamp: Date.now(),
      });
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
      .filter(([, realm]) => realm.entityType === "realm" || realm.entityType === "village")
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
      console.log("[Automation] Scheduled run fired", { timestamp: Date.now() });
      const processed = await processRealmsRef.current();
      if (processed) {
        setNextRunTimestampRef.current(Date.now() + PROCESS_INTERVAL_MS);
        console.log("[Automation] Next run scheduled", {
          nextRunTimestamp: Date.now() + PROCESS_INTERVAL_MS,
        });
      }
    };

    runAutomation();
    const intervalId = window.setInterval(runAutomation, PROCESS_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);
};
