import {
  buildExecutionSummary,
  buildRealmProductionPlan,
  buildRealmResourceSnapshot,
  planHasExecutableCalls,
  PROCESS_INTERVAL_MS,
  type RealmProductionPlan,
  type RealmResourceSnapshot,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import {
  useAutomationStore,
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  DONKEY_DEFAULT_RESOURCE_PERCENT,
  type ResourceAutomationPercentages,
  type RealmAutomationExecutionSummary,
} from "./store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { calculatePresetAllocations, getAutomationOverallocation } from "@/utils/automation-presets";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { getBlockTimestamp, getConservativeBlockTimestamp, configManager } from "@bibliothecadao/eternum";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Account as StarknetAccount } from "starknet";

const resolveResourceLabel = (resourceId: number): string => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : `Resource ${resourceId}`;
};

const labelResourceRecord = (record: Record<number, number>) =>
  Object.entries(record).map(([resourceId, amount]) => ({
    resourceId: Number(resourceId),
    resource: resolveResourceLabel(Number(resourceId)),
    amount,
  }));

const labelExecutionEntries = (entries: RealmAutomationExecutionSummary["resourceToResource"]) =>
  entries.map((entry) => ({
    ...entry,
    resource: resolveResourceLabel(entry.resourceId),
    inputs: entry.inputs.map((input) => ({
      ...input,
      resource: resolveResourceLabel(input.resourceId),
    })),
  }));

const labelPlanCallset = (plan: RealmProductionPlan) => ({
  resourceToResource: plan.callset.resourceToResource.map((call) => ({
    ...call,
    resource: resolveResourceLabel(call.resourceId),
  })),
  laborToResource: plan.callset.laborToResource.map((call) => ({
    ...call,
    resource: resolveResourceLabel(call.resourceId),
  })),
});

const formatSnapshotLog = (
  snapshot: RealmResourceSnapshot,
  customPercentages: Record<number, ResourceAutomationPercentages>,
) =>
  Array.from(snapshot.values())
    .filter((entry) => entry.hasActiveProduction || customPercentages[entry.resourceId])
    .map((entry) => ({
      resourceId: entry.resourceId,
      resource: resolveResourceLabel(entry.resourceId),
      balanceHuman: entry.balanceHuman,
      productionPerSecond: entry.productionPerSecond,
      hasActiveProduction: entry.hasActiveProduction,
    }));

const formatCustomPercentagesLog = (percentages: Record<number, ResourceAutomationPercentages>) =>
  Object.entries(percentages ?? {}).map(([resourceId, value]) => ({
    resourceId: Number(resourceId),
    resource: resolveResourceLabel(Number(resourceId)),
    percentages: value,
  }));

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
  const mode = useGameModeConfig();
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
    const managedStructures = [...playerRealms, ...playerVillages];
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    if (managedStructures.length === 0) {
      return;
    }

    managedStructures.forEach((structure) => {
      const entityType = structure.structure?.category === StructureType.Village ? "village" : "realm";
      const name = mode.structure.getName(structure.structure).name;
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
  }, [hydrated, playerRealms, playerVillages, removeRealm, upsertRealm, mode]);

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
      // Use conservative tick for resource validation to prevent tx failures from clock desync
      const { currentDefaultTick: conservativeTick } = getConservativeBlockTimestamp();

      // Phase 1: Build all plans synchronously (no awaits, so no event loop yields)
      const executablePlans: Array<{
        plan: RealmProductionPlan;
        realmConfig: (typeof realmList)[0];
        realmLabel: string;
        planLogPayload: Record<string, unknown>;
      }> = [];

      for (const realmConfig of realmList) {
        let activeRealmConfig = realmConfig;
        const realmIdNum = Number(activeRealmConfig.realmId);
        const realmLabel = activeRealmConfig.realmName ?? `Realm ${activeRealmConfig.realmId}`;

        const snapshot =
          Number.isFinite(realmIdNum) && realmIdNum > 0
            ? buildRealmResourceSnapshot({
                components,
                realmId: realmIdNum,
                currentTick: conservativeTick,
              })
            : new Map();

        console.log("[Automation] Prepared realm snapshot", {
          realmId: activeRealmConfig.realmId,
          realmName: realmLabel,
          blockTick: conservativeTick,
          balances: formatSnapshotLog(snapshot, activeRealmConfig.customPercentages),
        });

        const producedResourceIds: ResourcesIds[] = [];
        snapshot.forEach((entry) => {
          if (entry.hasActiveProduction) {
            producedResourceIds.push(entry.resourceId);
          }
        });

        if (activeRealmConfig.presetId === "idle") {
          console.log("[Automation] Skipping automation run due to idle preset", {
            realmId: activeRealmConfig.realmId,
            realmName: realmLabel,
          });
          continue;
        }

        if (activeRealmConfig.presetId === "custom" && activeRealmConfig.autoBalance) {
          try {
            const resourceIdsForCheck =
              producedResourceIds.length > 0
                ? producedResourceIds
                : Object.keys(activeRealmConfig.customPercentages ?? {}).map((key) => Number(key) as ResourcesIds);

            const effectivePercentages: Record<number, ResourceAutomationPercentages> = {};
            const smartDefaults = calculatePresetAllocations(
              resourceIdsForCheck,
              "smart",
              activeRealmConfig.entityType,
            );
            resourceIdsForCheck.forEach((resourceId) => {
              const stored = activeRealmConfig.customPercentages?.[resourceId];
              const smartDefault = smartDefaults.get(resourceId);
              const baseline =
                resourceId === ResourcesIds.Donkey
                  ? { resourceToResource: DONKEY_DEFAULT_RESOURCE_PERCENT, laborToResource: 0 }
                  : { ...DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES };
              effectivePercentages[resourceId] = stored ?? smartDefault ?? baseline;
            });

            const { resourceOver, laborOver } = getAutomationOverallocation(
              effectivePercentages,
              activeRealmConfig.entityType,
            );

            if (resourceOver || laborOver) {
              console.log("[Automation] Auto-switching to smart preset due to over-allocation", {
                realmId: activeRealmConfig.realmId,
                realmName: realmLabel,
                producedResourceIds,
                resourceOver,
                laborOver,
              });

              setRealmPreset(activeRealmConfig.realmId, "smart");
              const refreshed = getRealmConfig(activeRealmConfig.realmId);
              if (refreshed) {
                activeRealmConfig = refreshed;
              }
            }
          } catch (error) {
            console.error("[Automation] Failed to auto-balance custom allocations", activeRealmConfig.realmId, error);
          }
        }

        const plan = buildRealmProductionPlan({
          realmConfig: activeRealmConfig,
          snapshot,
        });

        const planLogPayload = {
          realmId: plan.realmId,
          realmName: realmLabel,
          presetId: activeRealmConfig.presetId,
          autoBalance: activeRealmConfig.autoBalance,
          evaluatedResources: plan.evaluatedResourceIds.map((resourceId) => ({
            resourceId,
            resource: resolveResourceLabel(resourceId),
          })),
          configuredResources: formatCustomPercentagesLog(activeRealmConfig.customPercentages),
          snapshot: formatSnapshotLog(snapshot, activeRealmConfig.customPercentages),
          callset: labelPlanCallset(plan),
          consumption: labelResourceRecord(plan.consumptionByResource),
          outputs: labelResourceRecord(plan.outputsByResource),
          skipped: plan.skipped.map((entry) => ({
            ...entry,
            resource: resolveResourceLabel(entry.resourceId),
          })),
        };

        console.log("[Automation] Planned production run", planLogPayload);

        if (!planHasExecutableCalls(plan)) {
          console.log("[Automation] No executable automation calls detected", planLogPayload);
          continue;
        }

        // Collect executable plans for parallel execution
        executablePlans.push({
          plan,
          realmConfig: activeRealmConfig,
          realmLabel,
          planLogPayload,
        });
      }

      // Phase 2: Execute all plans in parallel (enqueue all at once before any user actions can interleave)
      if (executablePlans.length > 0) {
        console.log(`[Automation] Executing ${executablePlans.length} production plans in parallel`);

        const results = await Promise.allSettled(
          executablePlans.map(async ({ plan, realmConfig, realmLabel, planLogPayload }) => {
            console.log("[Automation] Executing production plan", planLogPayload);
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
            return { plan, realmConfig, realmLabel, planLogPayload };
          }),
        );

        // Phase 3: Process results
        for (const result of results) {
          if (result.status === "fulfilled") {
            const { plan, realmConfig, realmLabel, planLogPayload } = result.value;
            const summary = buildExecutionSummary(plan, Date.now());
            recordExecution(realmConfig.realmId, summary);
            console.log("[Automation] Automation execution complete", {
              realmId: plan.realmId,
              realmName: realmLabel,
              outputs: planLogPayload.outputs,
              consumption: planLogPayload.consumption,
              resourceExecutions: labelExecutionEntries(plan.resourceExecutions),
              laborExecutions: labelExecutionEntries(plan.laborExecutions),
              skipped: planLogPayload.skipped,
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
          } else {
            // Extract realm info from the error if possible
            const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
            console.error(`Automation: Failed to execute plan`, errorMessage);
            toast.error(`Automation failed. Check console for details.`);
          }
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
        const customKeys = Object.keys(realm.customPercentages ?? {})
          .sort()
          .join(",");
        const presetId = realm.presetId ?? "smart";
        return `${realmId}:${presetId}:${customKeys}`;
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
