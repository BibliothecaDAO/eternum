import { resolveRunPrimaryAction } from "./presenters";
import type { FactoryRecoveryStepId, FactoryRun } from "./types";

const AUTO_RECOVERY_STORAGE_KEY = "factory-v2:auto-recovery";
const MAX_AUTO_RECOVERY_ATTEMPTS = 10;

interface FactoryAutoRecoveryRecord {
  retryCounts: Record<string, number>;
  lastActionKey?: string;
}

interface FactoryAutoRecoveryPlan {
  kind: "continue" | "retry";
  actionKey: string;
  launchScope: "full" | FactoryRecoveryStepId;
  stepId: FactoryRecoveryStepId;
  detail: string;
  notice: string;
  statusLabel: string;
  retryAttempt?: number;
}

function readAutoRecoveryStore() {
  if (typeof window === "undefined") {
    return {} as Record<string, FactoryAutoRecoveryRecord>;
  }

  try {
    const rawValue = window.localStorage.getItem(AUTO_RECOVERY_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as Record<string, FactoryAutoRecoveryRecord>) : {};
  } catch {
    return {};
  }
}

function writeAutoRecoveryStore(store: Record<string, FactoryAutoRecoveryRecord>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTO_RECOVERY_STORAGE_KEY, JSON.stringify(store));
}

function resolveAutoRecoveryRecord(runId: string): FactoryAutoRecoveryRecord {
  return readAutoRecoveryStore()[runId] ?? { retryCounts: {} };
}

function writeAutoRecoveryRecord(runId: string, nextRecord: FactoryAutoRecoveryRecord) {
  const currentStore = readAutoRecoveryStore();
  writeAutoRecoveryStore({
    ...currentStore,
    [runId]: nextRecord,
  });
}

function buildRunActionKey(run: FactoryRun, launchScope: string) {
  return `${run.id}|${run.syncKey}|${launchScope}`;
}

function buildAutoRetryNotice(launchScope: string, nextAttempt: number) {
  const attemptLabel = `${nextAttempt} of ${MAX_AUTO_RECOVERY_ATTEMPTS}`;

  if (launchScope === "full") {
    return `We hit a snag. Restarting the process automatically (${attemptLabel}).`;
  }

  return `We hit a snag. Trying that part again automatically (${attemptLabel}).`;
}

function buildAutoRetryLimitNotice(launchScope: string) {
  if (launchScope === "full") {
    return `We tried starting this game ${MAX_AUTO_RECOVERY_ATTEMPTS} times automatically. We need your help now.`;
  }

  return `We tried this part ${MAX_AUTO_RECOVERY_ATTEMPTS} times automatically. We need your help now.`;
}

export function resolveFactoryAutoRecoveryPlan(run: FactoryRun): FactoryAutoRecoveryPlan | null {
  const primaryAction = resolveRunPrimaryAction(run);

  if (!primaryAction) {
    return null;
  }

  const record = resolveAutoRecoveryRecord(run.id);
  const actionKey = buildRunActionKey(run, primaryAction.launchScope);

  if (record.lastActionKey === actionKey) {
    return null;
  }

  if (primaryAction.kind === "continue") {
    return {
      kind: "continue",
      actionKey,
      launchScope: primaryAction.launchScope,
      stepId: primaryAction.stepId,
      detail: "That part worked. Moving on automatically.",
      notice: "That part worked. Moving on automatically.",
      statusLabel: "Continuing",
    };
  }

  const retryCount = record.retryCounts[primaryAction.launchScope] ?? 0;

  if (retryCount >= MAX_AUTO_RECOVERY_ATTEMPTS) {
    return null;
  }

  const nextAttempt = retryCount + 1;
  const retryMessage = buildAutoRetryNotice(primaryAction.launchScope, nextAttempt);

  return {
    kind: "retry",
    actionKey,
    launchScope: primaryAction.launchScope,
    stepId: primaryAction.stepId,
    detail: retryMessage,
    notice: retryMessage,
    statusLabel: "Trying again",
    retryAttempt: nextAttempt,
  };
}

export function resolveFactoryAutoRecoveryLimitNotice(run: FactoryRun) {
  const primaryAction = resolveRunPrimaryAction(run);

  if (!primaryAction || primaryAction.kind !== "retry") {
    return null;
  }

  const record = resolveAutoRecoveryRecord(run.id);
  const retryCount = record.retryCounts[primaryAction.launchScope] ?? 0;

  if (retryCount < MAX_AUTO_RECOVERY_ATTEMPTS) {
    return null;
  }

  return buildAutoRetryLimitNotice(primaryAction.launchScope);
}

export function rememberFactoryAutoRecoveryPlan(runId: string, plan: FactoryAutoRecoveryPlan) {
  const currentRecord = resolveAutoRecoveryRecord(runId);
  const nextRetryCounts =
    plan.kind === "retry"
      ? {
          ...currentRecord.retryCounts,
          [plan.launchScope]: plan.retryAttempt ?? currentRecord.retryCounts[plan.launchScope] ?? 0,
        }
      : currentRecord.retryCounts;

  writeAutoRecoveryRecord(runId, {
    retryCounts: nextRetryCounts,
    lastActionKey: plan.actionKey,
  });
}
