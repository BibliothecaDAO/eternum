import {
  buildExecutionSummary,
  buildRealmProductionPlan,
  buildRealmResourceSnapshot,
  planHasExecutableCalls,
  PROCESS_INTERVAL_MS,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import {
  useAutomationStore,
  type ResourceAutomationPercentages,
  type ResourceAutomationSettings,
} from "./store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  calculateLimitedPresetPercentages,
  getAutomationOverallocation,
  type RealmPresetId,
} from "@/utils/automation-presets";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { getStructureName, getIsBlitz, getBlockTimestamp, configManager } from "@bibliothecadao/eternum";
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
  const setRealmPreset = useAutomationStore((state) => state.setRealmPreset);
  const setRealmPresetConfig = useAutomationStore((state) => state.setRealmPresetConfig);
  const getRealmConfig = useAutomationStore((state) => state.getRealmConfig);
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const removeRealm = useAutomationStore((state) => state.removeRealm);
  const pruneForGame = useAutomationStore((state) => state.pruneForGame);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const processingRef = useRef(false);
  const processRealmsRef = useRef<() => Promise<boolean>>(async () => false);
  const setNextRunTimestampRef = useRef(setNextRunTimestamp);
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const gameEndAt = useUIStore((state) => state.gameEndAt);
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
  const syncedRealmIdsRef = useRef<Set<string>>(new Set());

  const stopAutomation = useCallback(() => {
    if (automationTimeoutIdRef.current !== null) {
      window.clearTimeout(automationTimeoutIdRef.current);
      automationTimeoutIdRef.current = null;
    }
    setNextRunTimestampRef.current(null);
  }, []);

  const isGameOver = useCallback(
    (blockTimestampSeconds?: number) => {
      if (typeof gameEndAt !== "number") {
        return false;
      }
      const timestamp =
        typeof blockTimestampSeconds === "number" ? blockTimestampSeconds : getBlockTimestamp().currentBlockTimestamp;
      return timestamp >= gameEndAt;
    },
    [gameEndAt],
  );

  useEffect(() => {
    if (isGameOver()) {
      stopAutomation();
    }
  }, [isGameOver, stopAutomation]);

  useEffect(() => {
    if (!components) {
      return;
    }
    const season = configManager.getSeasonConfig();
    const gameId = `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
    pruneForGame(gameId);
  }, [components, pruneForGame]);

  useEffect(() => {
    if (!hydrated) {
      syncedRealmIdsRef.current.clear();
      return;
    }
    const blitzMode = getIsBlitz();
    const managedStructures = [...playerRealms, ...playerVillages];
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    if (managedStructures.length === 0) {
      return;
    }

    managedStructures.forEach((structure) => {
      const entityType = structure.structure?.category === StructureType.Village ? "village" : "realm";
      const name = getStructureName(structure.structure, blitzMode).name;
      const realmId = String(structure.entityId);
      syncedRealmIdsRef.current.add(realmId);

      upsertRealm(realmId, {
        realmName: name,
        entityType,
      });
    });

    Object.entries(useAutomationStore.getState().realms).forEach(([realmId, config]) => {
      const supportedType = config.entityType === "realm" || config.entityType === "village";
      const hasSyncedThisSession = syncedRealmIdsRef.current.has(realmId);
      if (!hasSyncedThisSession) {
        return;
      }
      if (!supportedType || !activeIds.has(realmId)) {
        removeRealm(realmId);
      }
    });
  }, [hydrated, playerRealms, playerVillages, removeRealm, upsertRealm]);

  const processRealms = useCallback(async (): Promise<boolean> => {
    if (processingRef.current) return false;

    if (isGameOver()) {
      console.log("Automation: Game has ended. Skipping automation pass.");
      return false;
    }

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
        let activeRealmConfig = realmConfig;
        const realmIdNum = Number(activeRealmConfig.realmId);

        const snapshot =
          Number.isFinite(realmIdNum) && realmIdNum > 0
            ? buildRealmResourceSnapshot({
                components,
                realmId: realmIdNum,
                currentTick: currentDefaultTick,
              })
            : new Map();

        const producedResourceIds: ResourcesIds[] = [];
        snapshot.forEach((entry) => {
          if (entry.hasActiveProduction) {
            producedResourceIds.push(entry.resourceId);
          }
        });

        // If config is over-allocated and still using a preset mode
        // (labor/resource/idle/custom), auto-apply a preset based on which side
        // (resources vs labor) is over the cap. Manual slider configs flow
        // through here as the "custom" preset so caps can still be enforced.
        const hasPreset =
          activeRealmConfig.presetId === "labor" ||
          activeRealmConfig.presetId === "resource" ||
          activeRealmConfig.presetId === "idle" ||
          activeRealmConfig.presetId === "custom";
        if (hasPreset) {
          try {
            let overAllocationConfig = activeRealmConfig;
            if (producedResourceIds.length > 0) {
              const limitedResources: Record<number, ResourceAutomationSettings> = {};
              producedResourceIds.forEach((resourceId) => {
                const existing = activeRealmConfig.resources[resourceId];
                if (existing) {
                  limitedResources[resourceId] = existing;
                }
              });
              overAllocationConfig = {
                ...activeRealmConfig,
                resources: limitedResources,
              };
            }

            const { resourceOver, laborOver } = getAutomationOverallocation(overAllocationConfig);
            let presetToApply: RealmPresetId | null = null;
            if (resourceOver && !laborOver) {
              presetToApply = "resource";
            } else if (!resourceOver && laborOver) {
              presetToApply = "labor";
            } else if (resourceOver && laborOver) {
              presetToApply = "custom";
            }

            if (presetToApply) {
              if (producedResourceIds.length > 0) {
                const limitedPercentagesMap = calculateLimitedPresetPercentages(
                  activeRealmConfig,
                  presetToApply,
                  producedResourceIds,
                );
                if (limitedPercentagesMap.size > 0) {
                  const percentages: Record<number, ResourceAutomationPercentages> = {};
                  limitedPercentagesMap.forEach((value, key) => {
                    percentages[key] = value;
                  });
                  setRealmPresetConfig(activeRealmConfig.realmId, presetToApply, percentages);
                  const refreshed = getRealmConfig(activeRealmConfig.realmId);
                  if (refreshed) {
                    activeRealmConfig = refreshed;
                  }
                }
              } else {
                // Fallback: apply preset using full config when no produced resources detected.
                setRealmPreset(activeRealmConfig.realmId, presetToApply);
                const refreshed = getRealmConfig(activeRealmConfig.realmId);
                if (refreshed) {
                  activeRealmConfig = refreshed;
                }
              }
            }
          } catch (error) {
            console.error(
              "[Automation] Failed to auto-apply preset for over-allocated realm",
              activeRealmConfig.realmId,
              error,
            );
          }
        }

        const plan = buildRealmProductionPlan({
          realmConfig: activeRealmConfig,
          snapshot,
        });

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
          recordExecution(activeRealmConfig.realmId, summary);
          anyExecuted = true;

          const producedResources = Object.entries(plan.outputsByResource);
          if (producedResources.length > 0) {
            const detail = producedResources
              .map(([resId, amount]) => {
                const label = resolveResourceLabel(Number(resId));
                return `${Math.round(amount).toLocaleString()} ${label}`;
              })
              .join(", ");
            toast.success(
              `Automation executed for ${activeRealmConfig.realmName ?? `Realm ${plan.realmId}`}: ${detail}`,
            );
          } else {
            toast.success(`Automation executed for ${activeRealmConfig.realmName ?? `Realm ${plan.realmId}`}.`);
          }
        } catch (error) {
          console.error(`Automation: Failed to execute plan for realm ${activeRealmConfig.realmId}`, error);
          toast.error(
            `Automation failed for ${activeRealmConfig.realmName ?? activeRealmConfig.realmId}. Check console for details.`,
          );
        }
      }
    } finally {
      processingRef.current = false;
    }

    return anyExecuted;
  }, [
    components,
    realms,
    execute_realm_production_plan,
    recordExecution,
    starknetSignerAccount,
    setRealmPreset,
    setRealmPresetConfig,
    getRealmConfig,
    isGameOver,
  ]);

  const runAutomationIfDue = useCallback(async () => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    const blockTimestampMs = currentBlockTimestamp * 1000;

    if (isGameOver(currentBlockTimestamp)) {
      stopAutomation();
      return;
    }

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
  }, [isGameOver, setNextRunTimestampRef, stopAutomation]);

  const scheduleNextCheck = useCallback(() => {
    if (isGameOver()) {
      stopAutomation();
      return;
    }
    if (automationTimeoutIdRef.current !== null) {
      window.clearTimeout(automationTimeoutIdRef.current);
    }
    const now = Date.now();
    const nextBlockMs = (Math.floor(now / 1000) + 1) * 1000;
    const delay = Math.max(250, nextBlockMs - now);
    automationTimeoutIdRef.current = window.setTimeout(() => {
      void runAutomationIfDue();
    }, delay);
  }, [isGameOver, runAutomationIfDue, stopAutomation]);

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
    if (isGameOver()) {
      stopAutomation();
      return;
    }

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
  }, [realms, isGameOver, stopAutomation]);

  useEffect(() => {
    if (isGameOver()) {
      stopAutomation();
      return () => {
        if (automationTimeoutIdRef.current !== null) {
          window.clearTimeout(automationTimeoutIdRef.current);
        }
      };
    }

    setNextRunTimestampRef.current(nextRunBlockTimestampRef.current);
    scheduleNextCheck();
    return () => {
      if (automationTimeoutIdRef.current !== null) {
        window.clearTimeout(automationTimeoutIdRef.current);
      }
    };
  }, [isGameOver, scheduleNextCheck, stopAutomation]);
};
