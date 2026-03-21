import type {
  FactoryRecoveryStepId,
  FactoryRun,
  FactoryRunRecovery,
  FactoryRunStatus,
  FactoryRunStep,
  FactoryStepStatus,
} from "../types";
import type { FactoryWorkerRunRecovery, FactoryWorkerRunRecord } from "./factory-worker";

export function mapFactoryWorkerRun(record: FactoryWorkerRunRecord): FactoryRun {
  const steps = record.steps.map(mapFactoryWorkerStep);

  return {
    id: record.runId,
    syncKey: buildFactoryRunSyncKey(record),
    mode: record.gameType,
    name: record.gameName,
    environment: record.environment,
    owner: "Factory",
    presetId: "",
    status: resolveFactoryRunStatus(record),
    summary: resolveFactoryRunSummary(record),
    updatedAt: formatFactoryUpdatedAt(record.updatedAt),
    recovery: mapFactoryRunRecovery(record.recovery),
    steps,
  };
}

function buildFactoryRunSyncKey(record: FactoryWorkerRunRecord) {
  return [
    record.latestLaunchRequestId,
    record.updatedAt,
    record.currentStepId ?? "none",
    record.status,
    ...record.steps.map((step) => `${step.id}:${step.status}:${step.finishedAt ?? step.startedAt ?? "none"}`),
  ].join("|");
}

export function mapAndSortFactoryWorkerRuns(records: FactoryWorkerRunRecord[]) {
  return [...records].sort(compareFactoryWorkerRunsByRecency).map(mapFactoryWorkerRun);
}

function mapFactoryWorkerStep(step: FactoryWorkerRunRecord["steps"][number]): FactoryRunStep {
  return {
    id: step.id,
    title: step.title,
    summary: step.latestEvent,
    workflowName: step.workflowStepName,
    status: resolveFactoryStepStatus(step.status),
    verification: step.errorMessage ?? step.latestEvent,
    latestEvent: step.errorMessage ?? step.latestEvent,
  };
}

function resolveFactoryRunStatus(record: FactoryWorkerRunRecord): FactoryRunStatus {
  if (record.status === "attention") {
    return "attention";
  }

  if (record.status === "complete") {
    return "complete";
  }

  return record.currentStepId?.startsWith("wait-") ? "waiting" : "running";
}

function resolveFactoryRunSummary(record: FactoryWorkerRunRecord) {
  switch (record.status) {
    case "attention":
      return "This game needs your help.";
    case "complete":
      return "This game is ready.";
    case "running":
    default:
      return record.currentStepId?.startsWith("wait-") ? "Waiting for the next step." : "Working on it now.";
  }
}

function resolveFactoryStepStatus(status: FactoryWorkerRunRecord["steps"][number]["status"]): FactoryStepStatus {
  switch (status) {
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "pending":
    default:
      return "pending";
  }
}

function mapFactoryRunRecovery(recovery: FactoryWorkerRunRecovery | undefined): FactoryRunRecovery | undefined {
  if (!recovery) {
    return undefined;
  }

  return {
    state: recovery.state,
    canContinue: recovery.canContinue,
    continueStepId: mapRecoveryStepId(recovery.continueStepId),
  };
}

function mapRecoveryStepId(stepId: FactoryWorkerRunRecovery["continueStepId"]): FactoryRecoveryStepId | null {
  switch (stepId) {
    case "create-world":
    case "wait-for-factory-index":
    case "configure-world":
    case "grant-lootchest-role":
    case "grant-village-pass-role":
    case "create-banks":
    case "create-indexer":
    case "sync-paymaster":
      return stepId;
    default:
      return null;
  }
}

function formatFactoryUpdatedAt(timestamp: string) {
  const deltaMs = Date.now() - Date.parse(timestamp);

  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return "Updated just now";
  }

  const deltaMinutes = Math.floor(deltaMs / 60_000);

  if (deltaMinutes < 1) {
    return "Updated just now";
  }

  if (deltaMinutes < 60) {
    return `Updated ${deltaMinutes} minute${deltaMinutes === 1 ? "" : "s"} ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);

  if (deltaHours < 24) {
    return `Updated ${deltaHours} hour${deltaHours === 1 ? "" : "s"} ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `Updated ${deltaDays} day${deltaDays === 1 ? "" : "s"} ago`;
}

function compareFactoryWorkerRunsByRecency(left: FactoryWorkerRunRecord, right: FactoryWorkerRunRecord) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}
