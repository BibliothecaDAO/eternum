import {
  buildExecutionSummary,
  buildRealmProductionPlan,
  planHasExecutableCalls,
  PROCESS_INTERVAL_MS,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import { useAutomationStore } from "./store/use-automation-store";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { getStructureName, getIsBlitz, getBlockTimestamp, ResourceManager, configManager } from "@bibliothecadao/eternum";
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
  const pruneForGame = useAutomationStore((state) => state.pruneForGame);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const processingRef = useRef(false);
  const processRealmsRef = useRef<() => Promise<boolean>>(async () => false);
  const setNextRunTimestampRef = useRef(setNextRunTimestamp);
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const realmResourcesSignatureRef = useRef<string>("");
  const initialBlockTimestampMsRef = useRef<number | null>(null);
  if (initialBlockTimestampMsRef.current === null) {
    initialBlockTimestampMsRef.current = getBlockTimestamp().currentBlockTimestamp * 1000;
  }
  const initialBlockTimestampMs = initialBlockTimestampMsRef.current!;
  const automationEnabledAtRef = useRef<number>(initialBlockTimestampMs + PROCESS_INTERVAL_MS);
  const lastRunBlockTimestampRef = useRef<number>(initialBlockTimestampMs);
  const nextRunBlockTimestampRef = useRef<number>(automationEnabledAtRef.current);
  const scheduleNextCheckRef = useRef<() => void>();
  const automationTimeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!components) {
      return;
    }
    const season = configManager.getSeasonConfig();
    const gameId = `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
    pruneForGame(gameId);
  }, [components, pruneForGame]);

  useEffect(() => {
    if (!hydrated) return;
    const blitzMode = getIsBlitz();
    const managedStructures = [...playerRealms, ...playerVillages];
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    if (managedStructures.length === 0) {
      return;
    }

    managedStructures.forEach((structure) => {
      const entityType = structure.structure?.category === StructureType.Village ? "village" : "realm";
      const name = getStructureName(structure.structure, blitzMode).name;

      upsertRealm(String(structure.entityId), {
        realmName: name,
        entityType,
      });
    });

    Object.entries(useAutomationStore.getState().realms).forEach(([realmId, config]) => {
      const supportedType = config.entityType === "realm" || config.entityType === "village";
      if (!supportedType || !activeIds.has(realmId)) {
        removeRealm(realmId);
      }
    });
  }, [hydrated, playerRealms, playerVillages, removeRealm, upsertRealm]);

  const processRealms = useCallback(async (): Promise<boolean> => {
    if (processingRef.current) return false;

    if (!starknetSignerAccount || !starknetSignerAccount.address || starknetSignerAccount.address === "0x0") {
      console.log("Automation: Missing Starknet signer. Skipping automation pass.");
      return false;
    }

    if (!components) {
      console.log("Automation: Missing Dojo components. Skipping automation pass.");
      return false;
    }

    const realmList = Object.values(realms).filter(
      (realm) => realm.entityType === "realm" || realm.entityType === "village",
    );
    if (realmList.length === 0) {
      return false;
    }

    processingRef.current = true;
    let anyExecuted = false;

    try {
      const { currentDefaultTick } = getBlockTimestamp();

      for (const realmConfig of realmList) {
        // Ensure resource configs exist for any active production before planning,
        // so initial allocations follow the realm preset instead of defaulting to labor.
        try {
          const realmIdNum = Number(realmConfig.realmId);
          if (Number.isFinite(realmIdNum) && realmIdNum > 0) {
            const resourceManager = new ResourceManager(components, realmIdNum);
            const resourceComponent = resourceManager.getResource();
            if (resourceComponent) {
              const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter(
                (value) => typeof value === "number",
              ) as ResourcesIds[];
              for (const resourceId of ALL_RESOURCE_IDS) {
                const prod = ResourceManager.balanceAndProduction(resourceComponent, resourceId).production;
                if (prod && prod.building_count > 0) {
                  ensureResourceConfig(realmConfig.realmId, resourceId);
                }
              }
            }
          }
        } catch (_e) {
          // Quietly continue; planning below still handles defaults
        }

        const plan = buildRealmProductionPlan({ realmConfig, components, currentTick: currentDefaultTick });
        if (!planHasExecutableCalls(plan)) {
          continue;
        }

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
          toast.error(
            `Automation failed for ${realmConfig.realmName ?? realmConfig.realmId}. Check console for details.`,
          );
        }
      }
    } finally {
      processingRef.current = false;
    }

    return anyExecuted;
  }, [components, realms, execute_realm_production_plan, recordExecution, ensureResourceConfig, starknetSignerAccount]);

  const runAutomationIfDue = useCallback(async () => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    const blockTimestampMs = currentBlockTimestamp * 1000;

    const lastRunMs = lastRunBlockTimestampRef.current ?? blockTimestampMs;
    const nextEligibleMs = Math.max(lastRunMs + PROCESS_INTERVAL_MS, automationEnabledAtRef.current);

    nextRunBlockTimestampRef.current = nextEligibleMs;
    setNextRunTimestampRef.current(nextEligibleMs);

    if (blockTimestampMs < nextEligibleMs) {
      scheduleNextCheckRef.current?.();
      return;
    }

    try {
      await processRealmsRef.current();
    } finally {
      lastRunBlockTimestampRef.current = blockTimestampMs;
      automationEnabledAtRef.current = blockTimestampMs + PROCESS_INTERVAL_MS;
      nextRunBlockTimestampRef.current = automationEnabledAtRef.current;
      setNextRunTimestampRef.current(nextRunBlockTimestampRef.current);
      scheduleNextCheckRef.current?.();
    }
  }, [setNextRunTimestampRef]);

  const scheduleNextCheck = useCallback(() => {
    if (automationTimeoutIdRef.current !== null) {
      window.clearTimeout(automationTimeoutIdRef.current);
    }
    const now = Date.now();
    const nextBlockMs = (Math.floor(now / 1000) + 1) * 1000;
    const delay = Math.max(250, nextBlockMs - now);
    automationTimeoutIdRef.current = window.setTimeout(() => {
      void runAutomationIfDue();
    }, delay);
  }, [runAutomationIfDue]);

  useEffect(() => {
    processRealmsRef.current = processRealms;
  }, [processRealms]);

  useEffect(() => {
    scheduleNextCheckRef.current = scheduleNextCheck;
  }, [scheduleNextCheck]);

  useEffect(() => {
    setNextRunTimestampRef.current = setNextRunTimestamp;
  }, [setNextRunTimestamp]);

  useEffect(() => {
    const signature = Object.entries(realms)
      .filter(([, realm]) => realm.entityType === "realm" || realm.entityType === "village")
      .map(([realmId, realm]) => {
        const resourceKeys = Object.keys(realm.resources ?? {})
          .sort()
          .join(",");
        return `${realmId}:${resourceKeys}`;
      })
      .sort()
      .join("|");

    if (signature !== realmResourcesSignatureRef.current) {
      realmResourcesSignatureRef.current = signature;
      const currentBlockMs = getBlockTimestamp().currentBlockTimestamp * 1000;
      if (currentBlockMs >= automationEnabledAtRef.current) {
        lastRunBlockTimestampRef.current = currentBlockMs;
        automationEnabledAtRef.current = currentBlockMs + PROCESS_INTERVAL_MS;
        nextRunBlockTimestampRef.current = automationEnabledAtRef.current;
        setNextRunTimestampRef.current(nextRunBlockTimestampRef.current);
        void processRealmsRef.current();
      }
      scheduleNextCheckRef.current?.();
    }
  }, [realms]);

  useEffect(() => {
    setNextRunTimestampRef.current(nextRunBlockTimestampRef.current);
    scheduleNextCheck();
    return () => {
      if (automationTimeoutIdRef.current !== null) {
        window.clearTimeout(automationTimeoutIdRef.current);
      }
    };
  }, [scheduleNextCheck]);
};
