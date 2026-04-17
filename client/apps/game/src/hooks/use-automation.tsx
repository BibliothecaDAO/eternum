import {
  buildAutomationPlanSkipMessage,
  buildExecutionSummary,
  buildRealmProductionPlan,
  buildRealmResourceSnapshot,
  planHasExecutableCalls,
  PROCESS_INTERVAL_MS,
  type RealmProductionPlan,
  type RealmResourceSnapshot,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import {
  AutomationCancelledError,
  AutomationSignerSkippedError,
  executeProductionPlansSequentially,
  isSignerTransientError,
  type ExecutableProductionPlan,
} from "@/ui/features/infrastructure/automation/model/automation-runner";
import { computeAutomationConfigSignature } from "@/utils/automation-signature";
import { isEntityOwnedByAccount } from "@/utils/entity-ownership";
import {
  computeNextEligibleMs,
  computePostPassSchedulerUpdate,
  computeScheduleDelayMs,
  shouldAdvanceSchedulerBookkeeping,
} from "./automation-scheduler";
import { useOwnedProductionStructureInfos } from "@/hooks/helpers/use-owned-structure-info";
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
import { useDojo } from "@bibliothecadao/react";
import { getBlockTimestamp, getConservativeBlockTimestamp, configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Account as StarknetAccount } from "starknet";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { extractReadableErrorMessage } from "@/utils/error-message";

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

type ProcessRealmsResult = { ran: boolean; anyExecuted: boolean };

export const useAutomation = () => {
  const {
    setup: {
      systemCalls: { execute_realm_production_plan },
      components,
    },
    account: { account: starknetSignerAccount },
  } = useDojo();

  const setNextRunTimestamp = useAutomationStore((state) => state.setNextRunTimestamp);
  const recordExecution = useAutomationStore((state) => state.recordExecution);
  const recordStatus = useAutomationStore((state) => state.recordStatus);
  const getRealmConfig = useAutomationStore((state) => state.getRealmConfig);
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const removeRealm = useAutomationStore((state) => state.removeRealm);
  const pruneForGame = useAutomationStore((state) => state.pruneForGame);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const processingRef = useRef(false);
  const processRealmsRef = useRef<() => Promise<ProcessRealmsResult>>(async () => ({
    ran: false,
    anyExecuted: false,
  }));
  const setNextRunTimestampRef = useRef(setNextRunTimestamp);
  const playerStructures = useOwnedProductionStructureInfos();
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const mode = useGameModeConfig();
  const realmResourcesSignatureRef = useRef<string>("");
  const initialAutomationTimestampMsRef = useRef<number | null>(null);
  if (initialAutomationTimestampMsRef.current === null) {
    initialAutomationTimestampMsRef.current = Date.now();
  }
  const initialAutomationTimestampMs = initialAutomationTimestampMsRef.current!;
  const automationEnabledAtRef = useRef<number>(initialAutomationTimestampMs + PROCESS_INTERVAL_MS);
  const lastRunTimestampRef = useRef<number>(initialAutomationTimestampMs);
  const nextRunTimestampRef = useRef<number>(automationEnabledAtRef.current);
  const scheduleNextCheckRef = useRef<() => void>();
  const automationTimeoutIdRef = useRef<number | null>(null);
  const syncedRealmIdsRef = useRef<Set<string>>(new Set());
  const pruneDuringProcessingRef = useRef<boolean>(false);

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

    const nowMs = Date.now();
    if (processingRef.current) {
      pruneDuringProcessingRef.current = true;
    }
    const update = computePostPassSchedulerUpdate(nowMs);
    lastRunTimestampRef.current = update.lastRunMs;
    automationEnabledAtRef.current = update.automationEnabledAtMs;
    nextRunTimestampRef.current = update.nextRunMs;
    setNextRunTimestampRef.current(nextRunTimestampRef.current);
  }, [components, pruneForGame]);

  useEffect(() => {
    if (!hydrated) {
      syncedRealmIdsRef.current.clear();
      return;
    }
    const managedStructures = playerStructures;
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    if (managedStructures.length === 0) {
      return;
    }

    managedStructures.forEach((structure) => {
      const entityType = isVillageLikeStructureCategory(structure.structure?.category) ? "village" : "realm";
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
  }, [hydrated, playerStructures, removeRealm, upsertRealm, mode]);

  const processRealms = useCallback(async (): Promise<ProcessRealmsResult> => {
    if (processingRef.current) return { ran: false, anyExecuted: false };

    if (isGameOver()) {
      console.log("Automation: Game has ended. Skipping automation pass.");
      return { ran: false, anyExecuted: false };
    }

    if (!starknetSignerAccount || !starknetSignerAccount.address || starknetSignerAccount.address === "0x0") {
      console.log("Automation: Missing Starknet signer. Skipping automation pass.");
      return { ran: false, anyExecuted: false };
    }

    if (!components) {
      console.log("Automation: Missing Dojo components. Skipping automation pass.");
      return { ran: false, anyExecuted: false };
    }

    const realmList = Object.values(useAutomationStore.getState().realms).filter(
      (realm) => realm.entityType === "realm" || realm.entityType === "village",
    );
    if (realmList.length === 0) {
      return { ran: false, anyExecuted: false };
    }

    processingRef.current = true;
    let anyExecuted = false;

    try {
      // Use conservative tick for resource validation to prevent tx failures from clock desync
      const { currentDefaultTick: conservativeTick } = getConservativeBlockTimestamp();

      // Phase 1: Build all plans synchronously (no awaits, so no event loop yields)
      const executablePlans: ExecutableProductionPlan[] = [];

      for (const realmConfig of realmList) {
        let activeRealmConfig = realmConfig;
        let runStatusNote: string | undefined;
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
          recordStatus(activeRealmConfig.realmId, {
            status: "skipped",
            message: "Idle preset",
            attemptedAt: Date.now(),
            consecutiveFailures: 0,
          });
          continue;
        }

        if (activeRealmConfig.presetId === "custom" && activeRealmConfig.autoBalance) {
          try {
            const resourceIdsForCheck = Array.from(
              new Set<ResourcesIds>([
                ...producedResourceIds,
                ...Object.keys(activeRealmConfig.customPercentages ?? {}).map((key) => Number(key) as ResourcesIds),
              ]),
            );

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
              runStatusNote = "Custom allocation over budget; used Smart for this run";
              console.log("[Automation] Using smart preset for this run due to over-allocation", {
                realmId: activeRealmConfig.realmId,
                realmName: realmLabel,
                producedResourceIds,
                resourceOver,
                laborOver,
              });

              activeRealmConfig = {
                ...activeRealmConfig,
                presetId: "smart",
                customPercentages: {},
              };
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
          recordExecution(activeRealmConfig.realmId, buildExecutionSummary(plan, Date.now()));
          recordStatus(activeRealmConfig.realmId, {
            status: "skipped",
            message: [runStatusNote, buildAutomationPlanSkipMessage(plan)].filter(Boolean).join("; "),
            attemptedAt: Date.now(),
            consecutiveFailures: 0,
          });
          continue;
        }

        // Collect executable plans for isolated execution.
        executablePlans.push({
          plan,
          realmConfig: activeRealmConfig,
          realmLabel,
          planLogPayload: {
            ...planLogPayload,
            runStatusNote,
          },
        });
      }

      // Phase 2: Execute all plans sequentially so isolated per-realm txs do not race the same signer nonce.
      console.log(
        `[Automation] Planning complete: ${executablePlans.length} executable out of ${realmList.length} realms`,
      );
      if (executablePlans.length > 0) {
        console.log(`[Automation] Executing ${executablePlans.length} production plans sequentially`);

        let signerFaultSurfacedForTick = false;
        const results = await executeProductionPlansSequentially({
          executablePlans,
          signer: starknetSignerAccount as StarknetAccount,
          executeRealmProductionPlan: execute_realm_production_plan,
          onBeforeExecute: ({ planLogPayload }) => {
            console.log("[Automation] Executing production plan", planLogPayload);
          },
          isCancelled: ({ plan, realmConfig }) => {
            if (isGameOver()) {
              return { cancelled: true, reason: "Game has ended", scope: "pass" };
            }
            const accountAddress = starknetSignerAccount?.address;
            if (!accountAddress || accountAddress === "0x0") {
              return { cancelled: true, reason: "Signer unavailable", scope: "pass" };
            }
            const realmIdNum = Number(realmConfig.realmId);
            const entityId = Number.isFinite(realmIdNum) && realmIdNum > 0 ? realmIdNum : plan.realmId;
            if (!isEntityOwnedByAccount(components, entityId, accountAddress)) {
              return { cancelled: true, reason: "Realm no longer owned", scope: "realm" };
            }
            return { cancelled: false };
          },
        });

        // Phase 3: Process results
        for (const result of results) {
          if (result.status === "fulfilled") {
            const { plan, realmConfig, realmLabel, planLogPayload } = result.value;
            const summary = buildExecutionSummary(plan, Date.now());
            recordExecution(realmConfig.realmId, summary);
            recordStatus(realmConfig.realmId, {
              status: "success",
              message: typeof planLogPayload.runStatusNote === "string" ? planLogPayload.runStatusNote : undefined,
              attemptedAt: Date.now(),
              consecutiveFailures: 0,
            });
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
            const rejection = result.reason;
            const rawError = rejection.error;
            const realmConfig = rejection.realmConfig;
            const realmLabel = rejection.realmLabel;

            if (rawError instanceof AutomationCancelledError) {
              console.log("[Automation] Skipped realm due to cancellation", {
                realmLabel,
                reason: rawError.message,
                scope: rawError.scope,
              });
              if (realmConfig) {
                const prev = getRealmConfig(realmConfig.realmId);
                recordStatus(realmConfig.realmId, {
                  status: "skipped",
                  message: rawError.message,
                  attemptedAt: Date.now(),
                  consecutiveFailures: prev?.lastStatus?.consecutiveFailures ?? 0,
                });
              }
              continue;
            }

            if (rawError instanceof AutomationSignerSkippedError) {
              console.log("[Automation] Skipped realm after signer fault earlier in pass", {
                realmLabel,
                reason: rawError.message,
              });
              if (realmConfig) {
                const prev = getRealmConfig(realmConfig.realmId);
                recordStatus(realmConfig.realmId, {
                  status: "skipped",
                  message: rawError.message,
                  attemptedAt: Date.now(),
                  consecutiveFailures: prev?.lastStatus?.consecutiveFailures ?? 0,
                });
              }
              continue;
            }

            const errorMessage = extractReadableErrorMessage(rawError, "Automation transaction failed");
            const isSignerFault = isSignerTransientError(rawError);

            console.error(`Automation: Failed to execute plan for ${realmLabel}`, {
              error: rawError,
              message: errorMessage,
            });

            if (realmConfig) {
              const prev = getRealmConfig(realmConfig.realmId);
              recordStatus(realmConfig.realmId, {
                status: "failed",
                message: errorMessage,
                attemptedAt: Date.now(),
                consecutiveFailures: isSignerFault
                  ? (prev?.lastStatus?.consecutiveFailures ?? 0)
                  : (prev?.lastStatus?.consecutiveFailures ?? 0) + 1,
              });
            }

            if (isSignerFault) {
              if (!signerFaultSurfacedForTick) {
                signerFaultSurfacedForTick = true;
                toast.error(`Automation paused this tick: signer error — next tick will retry (${errorMessage})`);
              }
            } else {
              toast.error(`Automation failed for ${realmLabel}: ${errorMessage}`);
            }
          }
        }
      }
    } finally {
      processingRef.current = false;
    }

    return { ran: true, anyExecuted };
  }, [
    components,
    execute_realm_production_plan,
    recordExecution,
    recordStatus,
    starknetSignerAccount,
    getRealmConfig,
    isGameOver,
  ]);

  const runAutomationIfDue = useCallback(async () => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    // Use wall clock time for scheduling so stale chain time cannot freeze automation.
    const nowMs = Date.now();

    if (isGameOver(currentBlockTimestamp)) {
      stopAutomation();
      return;
    }

    const lastRunMs = lastRunTimestampRef.current ?? nowMs;
    const nextEligibleMs = computeNextEligibleMs(lastRunMs, automationEnabledAtRef.current);

    nextRunTimestampRef.current = nextEligibleMs;
    setNextRunTimestampRef.current(nextEligibleMs);

    if (nowMs < nextEligibleMs) {
      scheduleNextCheckRef.current?.();
      return;
    }

    let ran = false;
    try {
      const result = await processRealmsRef.current();
      ran = result.ran;
    } finally {
      if (shouldAdvanceSchedulerBookkeeping(ran, pruneDuringProcessingRef.current)) {
        const update = computePostPassSchedulerUpdate(nowMs);
        lastRunTimestampRef.current = update.lastRunMs;
        automationEnabledAtRef.current = update.automationEnabledAtMs;
        nextRunTimestampRef.current = update.nextRunMs;
        setNextRunTimestampRef.current(nextRunTimestampRef.current);
      }
      pruneDuringProcessingRef.current = false;
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
    const delay = computeScheduleDelayMs(Date.now());
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
    const unsub = useAutomationStore.subscribe((state, prevState) => {
      if (state.realms === prevState.realms) return;
      if (isGameOver()) return;

      const newSignature = computeAutomationConfigSignature(state.realms);
      if (newSignature !== realmResourcesSignatureRef.current) {
        realmResourcesSignatureRef.current = newSignature;
        const nowMs = Date.now();
        if (nowMs >= automationEnabledAtRef.current && !processingRef.current) {
          void (async () => {
            const result = await processRealmsRef.current();
            if (shouldAdvanceSchedulerBookkeeping(result.ran, pruneDuringProcessingRef.current)) {
              const update = computePostPassSchedulerUpdate(nowMs);
              lastRunTimestampRef.current = update.lastRunMs;
              automationEnabledAtRef.current = update.automationEnabledAtMs;
              nextRunTimestampRef.current = update.nextRunMs;
              setNextRunTimestampRef.current(nextRunTimestampRef.current);
            }
            pruneDuringProcessingRef.current = false;
          })();
        }
        scheduleNextCheckRef.current?.();
      }
    });
    return unsub;
  }, [isGameOver]);

  useEffect(() => {
    if (isGameOver()) {
      stopAutomation();
      return () => {
        if (automationTimeoutIdRef.current !== null) {
          window.clearTimeout(automationTimeoutIdRef.current);
        }
      };
    }

    setNextRunTimestampRef.current(nextRunTimestampRef.current);
    scheduleNextCheck();
    return () => {
      if (automationTimeoutIdRef.current !== null) {
        window.clearTimeout(automationTimeoutIdRef.current);
      }
    };
  }, [isGameOver, scheduleNextCheck, stopAutomation]);
};
