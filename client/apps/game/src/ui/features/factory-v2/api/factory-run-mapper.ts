import type {
  FactoryAutoRetryState,
  FactoryPrizeFundingState,
  FactoryRecoveryStepId,
  FactoryRotationEvaluationState,
  FactoryRun,
  FactoryRunRecovery,
  FactoryRunStatus,
  FactorySeriesChildStep,
  FactoryRunStep,
  FactoryRunStepId,
  FactorySeriesChildRun,
  FactorySeriesChildStatus,
  FactoryStepStatus,
} from "../types";
import type {
  FactoryWorkerGameRunRecord,
  FactoryWorkerPrizeFundingState,
  FactoryWorkerRunRecord,
  FactoryWorkerRunRecovery,
  FactoryWorkerRotationRunRecord,
  FactoryWorkerSeriesAutoRetry,
  FactoryWorkerSeriesGameRecord,
  FactoryWorkerSeriesRunRecord,
} from "./factory-worker";

export function mapFactoryWorkerRun(record: FactoryWorkerRunRecord): FactoryRun {
  if (isFactoryWorkerRotationRunRecord(record)) {
    return mapFactoryWorkerRotationRun(record);
  }

  if (isFactoryWorkerSeriesRunRecord(record)) {
    return mapFactoryWorkerSeriesRun(record);
  }

  return mapFactoryWorkerGameRun(record);
}

export function mapAndSortFactoryWorkerRuns(records: FactoryWorkerRunRecord[]) {
  return [...records].sort(compareFactoryWorkerRunsByRecency).map(mapFactoryWorkerRun);
}

function isFactoryWorkerSeriesRunRecord(record: FactoryWorkerRunRecord): record is FactoryWorkerSeriesRunRecord {
  return record.kind === "series";
}

function isFactoryWorkerRotationRunRecord(record: FactoryWorkerRunRecord): record is FactoryWorkerRotationRunRecord {
  return record.kind === "rotation";
}

function mapFactoryWorkerGameRun(record: FactoryWorkerGameRunRecord): FactoryRun {
  return {
    id: record.runId,
    syncKey: buildFactoryGameRunSyncKey(record),
    kind: "game",
    mode: record.gameType,
    name: record.gameName,
    environment: record.environment,
    owner: "Factory",
    presetId: "",
    status: resolveFactoryRunStatus(record.status, record.currentStepId),
    summary: resolveFactoryGameRunSummary(record.status, record.currentStepId),
    updatedAt: formatFactoryUpdatedAt(record.updatedAt),
    worldAddress: record.artifacts.worldAddress,
    recovery: mapFactoryRunRecovery(record.recovery),
    prizeFunding: mapFactoryPrizeFunding(record.artifacts.prizeFunding),
    steps: record.steps.map(mapFactoryWorkerStep),
  };
}

function mapFactoryWorkerSeriesRun(record: FactoryWorkerSeriesRunRecord): FactoryRun {
  return {
    id: record.runId,
    syncKey: buildFactorySeriesRunSyncKey(record),
    kind: "series",
    mode: record.gameType,
    name: record.seriesName,
    environment: record.environment,
    owner: "Factory",
    presetId: "",
    status: resolveFactoryRunStatus(record.status, record.currentStepId),
    summary: resolveFactorySeriesRunSummary(record.status, record.currentStepId),
    updatedAt: formatFactoryUpdatedAt(record.updatedAt),
    recovery: mapFactoryRunRecovery(record.recovery),
    autoRetry: mapFactoryAutoRetry(record.autoRetry),
    children: record.summary.games.map(mapFactorySeriesChildRun),
    steps: record.steps.map(mapFactoryWorkerStep),
  };
}

function mapFactoryWorkerRotationRun(record: FactoryWorkerRotationRunRecord): FactoryRun {
  return {
    id: record.runId,
    syncKey: buildFactoryRotationRunSyncKey(record),
    kind: "rotation",
    mode: record.gameType,
    name: record.rotationName,
    environment: record.environment,
    owner: "Factory",
    presetId: "",
    status: resolveFactoryRunStatus(record.status, record.currentStepId),
    summary: resolveFactoryRotationRunSummary(record.status, record.currentStepId),
    updatedAt: formatFactoryUpdatedAt(record.updatedAt),
    recovery: mapFactoryRunRecovery(record.recovery),
    autoRetry: mapFactoryAutoRetry(record.autoRetry),
    evaluation: mapFactoryRotationEvaluation(record.evaluation),
    rotation: mapFactoryRotationState(record),
    children: record.summary.games.map(mapFactorySeriesChildRun),
    steps: record.steps.map(mapFactoryWorkerStep),
  };
}

function buildFactoryGameRunSyncKey(record: FactoryWorkerGameRunRecord) {
  return [
    record.latestLaunchRequestId,
    record.updatedAt,
    record.currentStepId ?? "none",
    record.status,
    ...record.steps.map((step) => `${step.id}:${step.status}:${step.finishedAt ?? step.startedAt ?? "none"}`),
  ].join("|");
}

function buildFactorySeriesRunSyncKey(record: FactoryWorkerSeriesRunRecord) {
  return [
    record.latestLaunchRequestId,
    record.updatedAt,
    record.currentStepId ?? "none",
    record.status,
    ...record.steps.map((step) => `${step.id}:${step.status}:${step.finishedAt ?? step.startedAt ?? "none"}`),
    ...record.summary.games.map(
      (game) =>
        `${game.gameName}:${game.status}:${game.currentStepId ?? "none"}:${(game.steps || [])
          .map(
            (step) => `${step.id}:${step.status}:${step.updatedAt ?? "none"}:${step.errorMessage ?? step.latestEvent}`,
          )
          .join(",")}`,
    ),
    record.autoRetry.enabled ? "auto:on" : "auto:off",
    record.autoRetry.nextRetryAt ?? "no-next-retry",
    record.autoRetry.lastRetryAt ?? "no-last-retry",
  ].join("|");
}

function buildFactoryRotationRunSyncKey(record: FactoryWorkerRotationRunRecord) {
  return [
    record.latestLaunchRequestId,
    record.updatedAt,
    record.currentStepId ?? "none",
    record.status,
    ...record.steps.map((step) => `${step.id}:${step.status}:${step.finishedAt ?? step.startedAt ?? "none"}`),
    ...record.summary.games.map(
      (game) =>
        `${game.gameName}:${game.status}:${game.currentStepId ?? "none"}:${(game.steps || [])
          .map(
            (step) => `${step.id}:${step.status}:${step.updatedAt ?? "none"}:${step.errorMessage ?? step.latestEvent}`,
          )
          .join(",")}`,
    ),
    record.autoRetry.enabled ? "auto:on" : "auto:off",
    record.autoRetry.nextRetryAt ?? "no-next-retry",
    record.evaluation.nextEvaluationAt ?? "no-next-evaluation",
    record.evaluation.lastNudgedAt ?? "no-last-nudge",
  ].join("|");
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

function mapFactorySeriesChildRun(game: FactoryWorkerSeriesGameRecord): FactorySeriesChildRun {
  return {
    id: `${game.gameName}:${game.seriesGameNumber}`,
    gameName: game.gameName,
    seriesGameNumber: game.seriesGameNumber,
    startTimeIso: game.startTimeIso,
    status: resolveFactorySeriesChildStatus(game.status),
    latestEvent: game.latestEvent,
    currentStepId: mapFactoryStepId(game.currentStepId),
    steps: (game.steps || []).map(mapFactorySeriesChildStep),
    configReady: hasSucceededFactorySeriesChildStep(game, "configure-worlds"),
    worldAddress: game.artifacts.worldAddress,
    indexerCreated: game.artifacts.indexerCreated,
    indexerTier: game.artifacts.indexerTier,
    prizeFunding: mapFactoryPrizeFunding(game.artifacts.prizeFunding),
  };
}

function mapFactorySeriesChildStep(
  step: NonNullable<FactoryWorkerSeriesGameRecord["steps"]>[number],
): FactorySeriesChildStep {
  return {
    id: mapFactoryStepId(step.id) ?? "create-worlds",
    status: resolveFactoryStepStatus(step.status),
    latestEvent: step.latestEvent,
    errorMessage: step.errorMessage,
  };
}

function mapFactoryPrizeFunding(
  prizeFunding: FactoryWorkerPrizeFundingState | undefined,
): FactoryPrizeFundingState | undefined {
  if (!prizeFunding) {
    return undefined;
  }

  return {
    transfers: prizeFunding.transfers.map((transfer) => ({
      id: transfer.id,
      tokenAddress: transfer.tokenAddress,
      amountRaw: transfer.amountRaw,
      amountDisplay: transfer.amountDisplay,
      decimals: transfer.decimals,
      transactionHash: transfer.transactionHash,
      fundedAt: transfer.fundedAt,
    })),
  };
}

function resolveFactoryRunStatus(
  status: FactoryWorkerRunRecord["status"],
  currentStepId: string | null,
): FactoryRunStatus {
  if (status === "attention") {
    return "attention";
  }

  if (status === "complete") {
    return "complete";
  }

  return String(currentStepId).startsWith("wait-") ? "waiting" : "running";
}

function resolveFactoryGameRunSummary(status: FactoryWorkerGameRunRecord["status"], currentStepId: string | null) {
  switch (status) {
    case "attention":
      return "This game needs your help.";
    case "complete":
      return "This game is ready.";
    case "running":
    default:
      return String(currentStepId).startsWith("wait-") ? "Waiting for the next step." : "Working on it now.";
  }
}

function resolveFactorySeriesRunSummary(status: FactoryWorkerSeriesRunRecord["status"], currentStepId: string | null) {
  switch (status) {
    case "attention":
      return "This series needs your help.";
    case "complete":
      return "This series is ready.";
    case "running":
    default:
      return String(currentStepId).startsWith("wait-")
        ? "Waiting for the next series step."
        : "Working through this series now.";
  }
}

function resolveFactoryRotationRunSummary(
  status: FactoryWorkerRotationRunRecord["status"],
  currentStepId: string | null,
) {
  switch (status) {
    case "attention":
      return "This rotation needs your help.";
    case "complete":
      return "This rotation is fully queued.";
    case "running":
    default:
      return String(currentStepId).startsWith("wait-")
        ? "Waiting for the next rotation checkpoint."
        : "Keeping this rotation filled and ready.";
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

function resolveFactorySeriesChildStatus(status: FactoryWorkerSeriesGameRecord["status"]): FactorySeriesChildStatus {
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

function hasSucceededFactorySeriesChildStep(game: FactoryWorkerSeriesGameRecord, stepId: string) {
  return (game.steps ?? []).some((step) => step.id === stepId && step.status === "succeeded");
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

function mapFactoryAutoRetry(autoRetry: FactoryWorkerSeriesAutoRetry | undefined): FactoryAutoRetryState | undefined {
  if (!autoRetry) {
    return undefined;
  }

  return {
    enabled: autoRetry.enabled,
    intervalMinutes: autoRetry.intervalMinutes,
    nextRetryAt: autoRetry.nextRetryAt ?? null,
    lastRetryAt: autoRetry.lastRetryAt ?? null,
    cancelledAt: autoRetry.cancelledAt ?? null,
    cancelReason: autoRetry.cancelReason ?? null,
  };
}

function mapFactoryRotationEvaluation(
  evaluation: FactoryWorkerRotationRunRecord["evaluation"] | undefined,
): FactoryRotationEvaluationState | undefined {
  if (!evaluation) {
    return undefined;
  }

  return {
    intervalMinutes: evaluation.intervalMinutes,
    nextEvaluationAt: evaluation.nextEvaluationAt ?? null,
    lastEvaluatedAt: evaluation.lastEvaluatedAt ?? null,
    lastNudgedAt: evaluation.lastNudgedAt ?? null,
  };
}

function mapFactoryRotationState(record: FactoryWorkerRotationRunRecord): FactoryRun["rotation"] {
  return {
    rotationName: record.rotationName,
    maxGames: record.summary.maxGames,
    advanceWindowGames: record.summary.advanceWindowGames,
    createdGameCount: record.summary.games.length,
    queuedGameCount: record.summary.games.filter((game) => game.startTime * 1000 > Date.now()).length,
    gameIntervalMinutes: record.summary.gameIntervalMinutes,
    firstGameStartTimeIso: record.summary.firstGameStartTimeIso,
  };
}

function mapRecoveryStepId(stepId: FactoryWorkerRunRecovery["continueStepId"]): FactoryRecoveryStepId | null {
  switch (stepId) {
    case "create-series":
    case "create-world":
    case "create-worlds":
    case "wait-for-factory-index":
    case "wait-for-factory-indexes":
    case "configure-world":
    case "configure-worlds":
    case "grant-lootchest-role":
    case "grant-lootchest-roles":
    case "grant-village-pass-role":
    case "grant-village-pass-roles":
    case "create-banks":
    case "create-indexer":
    case "create-indexers":
    case "sync-paymaster":
      return stepId;
    default:
      return null;
  }
}

function mapFactoryStepId(stepId: string | null | undefined): FactoryRunStepId | null {
  switch (stepId) {
    case "create-series":
    case "create-world":
    case "create-worlds":
    case "wait-factory-index":
    case "wait-for-factory-index":
    case "wait-for-factory-indexes":
    case "apply-config":
    case "configure-world":
    case "configure-worlds":
    case "grant-lootchest-role":
    case "grant-lootchest-roles":
    case "grant-village-pass":
    case "grant-village-pass-role":
    case "grant-village-pass-roles":
    case "create-banks":
    case "create-indexer":
    case "create-indexers":
    case "wait-indexer":
    case "sync-paymaster":
    case "publish-ready-state":
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
