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
import { isSignerTransientError } from "@/ui/features/infrastructure/automation/model/automation-runner";
import { computeAutomationConfigSignature } from "@/utils/automation-signature";
import { verboseLog } from "@/utils/dev-mode";
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
import { getAutomationProjectionTick, getBlockTimestamp, configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { extractReadableErrorMessage, isInsufficientResourceBalanceRevert } from "@/utils/error-message";

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
      // The registry status flips to Ended/Settled the moment a season-close
      // or settle tx lands — including EARLY closes (points win before end_at)
      // — so it must win over the timestamp check, and it also covers unscoped
      // boots where the UI store's gameEndAt never hydrated. This closes the
      // "Season is over" revert loop from automation submitting into an ended
      // game.
      if (configManager.isGameOver()) {
        return true;
      }
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
      verboseLog("Automation: Game has ended. Skipping automation pass.");
      return { ran: false, anyExecuted: false };
    }

    if (!starknetSignerAccount || !starknetSignerAccount.address || starknetSignerAccount.address === "0x0") {
      verboseLog("Automation: Missing Starknet signer. Skipping automation pass.");
      return { ran: false, anyExecuted: false };
    }

    if (!components) {
      verboseLog("Automation: Missing Dojo components. Skipping automation pass.");
      return { ran: false, anyExecuted: false };
    }

    const realmList = Object.values(useAutomationStore.getState().realms).filter(
      (realm) => realm.entityType === "realm" || realm.entityType === "village",
    );
    if (realmList.length === 0) {
      return { ran: false, anyExecuted: false };
    }

    const recordRealmSkippedStatus = ({
      realmId,
      message,
      resetConsecutiveFailures = false,
    }: {
      realmId: string;
      message: string;
      resetConsecutiveFailures?: boolean;
    }) => {
      const prev = getRealmConfig(realmId);
      recordStatus(realmId, {
        status: "skipped",
        message,
        attemptedAt: Date.now(),
        consecutiveFailures: resetConsecutiveFailures ? 0 : (prev?.lastStatus?.consecutiveFailures ?? 0),
      });
    };

    processingRef.current = true;
    let anyExecuted = false;

    try {
      let skipRemainingRealmsMessage: string | null = null;
      let signerFaultSurfacedForTick = false;

      verboseLog(`[Automation] Starting just-in-time planning for ${realmList.length} realms`);
      for (const realmConfig of realmList) {
        const realmLabel = realmConfig.realmName ?? `Realm ${realmConfig.realmId}`;

        if (skipRemainingRealmsMessage) {
          recordRealmSkippedStatus({
            realmId: realmConfig.realmId,
            message: skipRemainingRealmsMessage,
          });
          continue;
        }

        if (isGameOver()) {
          skipRemainingRealmsMessage = "Game has ended";
          recordRealmSkippedStatus({
            realmId: realmConfig.realmId,
            message: skipRemainingRealmsMessage,
          });
          continue;
        }

        const accountAddress = starknetSignerAccount?.address;
        if (!accountAddress || accountAddress === "0x0") {
          skipRemainingRealmsMessage = "Signer unavailable";
          recordRealmSkippedStatus({
            realmId: realmConfig.realmId,
            message: skipRemainingRealmsMessage,
          });
          continue;
        }

        let activeRealmConfig = realmConfig;
        let runStatusNote: string | undefined;
        const realmIdNum = Number(activeRealmConfig.realmId);
        if (
          Number.isFinite(realmIdNum) &&
          realmIdNum > 0 &&
          !isEntityOwnedByAccount(components, realmIdNum, accountAddress)
        ) {
          recordRealmSkippedStatus({
            realmId: activeRealmConfig.realmId,
            message: "Realm no longer owned",
          });
          continue;
        }

        // Rebuild the conservative projection immediately before each realm submission so
        // projected balances reflect the freshest local state available at submit time.
        const { currentDefaultTick: conservativeTick } = getAutomationProjectionTick();
        const rawSnapshot: RealmResourceSnapshot =
          Number.isFinite(realmIdNum) && realmIdNum > 0
            ? buildRealmResourceSnapshot({
                components,
                realmId: realmIdNum,
                currentTick: conservativeTick,
              })
            : new Map();
        const snapshot = rawSnapshot;

        verboseLog("[Automation] Prepared realm snapshot", {
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
          verboseLog("[Automation] Skipping automation run due to idle preset", {
            realmId: activeRealmConfig.realmId,
            realmName: realmLabel,
          });
          recordRealmSkippedStatus({
            realmId: activeRealmConfig.realmId,
            message: "Idle preset",
            resetConsecutiveFailures: true,
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
              verboseLog("[Automation] Using smart preset for this run due to over-allocation", {
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

        verboseLog("[Automation] Planned production run", planLogPayload);

        if (!planHasExecutableCalls(plan)) {
          verboseLog("[Automation] No executable automation calls detected", planLogPayload);
          recordExecution(activeRealmConfig.realmId, buildExecutionSummary(plan, Date.now()));
          recordRealmSkippedStatus({
            realmId: activeRealmConfig.realmId,
            message: [runStatusNote, buildAutomationPlanSkipMessage(plan)].filter(Boolean).join("; "),
            resetConsecutiveFailures: true,
          });
          continue;
        }

        if (isGameOver()) {
          skipRemainingRealmsMessage = "Game has ended";
          recordRealmSkippedStatus({
            realmId: activeRealmConfig.realmId,
            message: skipRemainingRealmsMessage,
          });
          continue;
        }
        if (
          Number.isFinite(realmIdNum) &&
          realmIdNum > 0 &&
          !isEntityOwnedByAccount(components, realmIdNum, accountAddress)
        ) {
          recordRealmSkippedStatus({
            realmId: activeRealmConfig.realmId,
            message: "Realm no longer owned",
          });
          continue;
        }

        const planLogPayloadWithStatus = {
          ...planLogPayload,
          runStatusNote,
        };

        verboseLog("[Automation] Executing production plan", planLogPayloadWithStatus);

        try {
          await execute_realm_production_plan({
            signer: starknetSignerAccount,
            realm_entity_id: plan.realmId,
            skipQueue: true,
            resource_to_resource: plan.callset.resourceToResource.map((item) => ({
              resource_id: item.resourceId,
              cycles: item.cycles,
            })),
            labor_to_resource: plan.callset.laborToResource.map((item) => ({
              resource_id: item.resourceId,
              cycles: item.cycles,
            })),
          });

          const summary = buildExecutionSummary(plan, Date.now());
          recordExecution(activeRealmConfig.realmId, summary);
          recordStatus(activeRealmConfig.realmId, {
            status: "success",
            message:
              typeof planLogPayloadWithStatus.runStatusNote === "string"
                ? planLogPayloadWithStatus.runStatusNote
                : undefined,
            attemptedAt: Date.now(),
            consecutiveFailures: 0,
          });
          verboseLog("[Automation] Automation execution complete", {
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
            toast.success(
              `Automation executed for ${activeRealmConfig.realmName ?? `Realm ${plan.realmId}`}: ${detail}`,
            );
          } else {
            toast.success(`Automation executed for ${activeRealmConfig.realmName ?? `Realm ${plan.realmId}`}.`);
          }
        } catch (rawError) {
          const errorMessage = extractReadableErrorMessage(rawError, "Automation transaction failed");
          const isSignerFault = isSignerTransientError(rawError);

          console.error(`Automation: Failed to execute plan for ${realmLabel}`, {
            error: rawError,
            message: errorMessage,
          });

          const prev = getRealmConfig(activeRealmConfig.realmId);
          recordStatus(activeRealmConfig.realmId, {
            status: "failed",
            message: errorMessage,
            attemptedAt: Date.now(),
            consecutiveFailures: isSignerFault
              ? (prev?.lastStatus?.consecutiveFailures ?? 0)
              : (prev?.lastStatus?.consecutiveFailures ?? 0) + 1,
          });

          if (isSignerFault) {
            skipRemainingRealmsMessage = "Skipped: signer error earlier in pass — next tick will retry";
            if (!signerFaultSurfacedForTick) {
              signerFaultSurfacedForTick = true;
              toast.error(`Automation paused this tick: signer error — next tick will retry (${errorMessage})`);
            }
          } else {
            toast.error(`Automation failed for ${realmLabel}: ${errorMessage}`);
            if (isInsufficientResourceBalanceRevert(errorMessage)) {
              console.warn(
                `[Automation] Insufficient-balance revert for ${realmLabel}; the next Herald Resource diff will reconcile the projection.`,
                labelResourceRecord(plan.consumptionByResource),
              );
            }
          }
        }
      }

      if (skipRemainingRealmsMessage) {
        verboseLog("[Automation] Pass ended early", {
          reason: skipRemainingRealmsMessage,
        });
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
