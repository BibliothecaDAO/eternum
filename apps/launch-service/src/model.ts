import type {
  LaunchGameSummary,
  LaunchRotationSummary,
  LaunchSeriesSummary,
} from "../../../config/deployer/clean/types";
import type { LaunchJobRequest, LaunchKind } from "./schemas";

export type LaunchJobStatus = "queued" | "running" | "complete" | "failed" | "cancelled";
export type LaunchSummary = LaunchGameSummary | LaunchSeriesSummary | LaunchRotationSummary;

export interface LaunchRun {
  id: string;
  kind: LaunchKind;
  environment: "madara.blitz";
  name: string;
  request: LaunchJobRequest;
  status: LaunchJobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  claimedUntil?: string;
  leaseToken?: string;
  completedAt?: string;
  errorMessage?: string;
  summary?: LaunchSummary;
}

export interface ClaimedLaunchRun extends LaunchRun {
  status: "running";
  claimedUntil: string;
  leaseToken: string;
}

const GAME_STEPS = [
  ["create-world", "Create game"],
  ["wait-for-factory-index", "Wait for Herald"],
] as const;
const GROUP_STEPS = [
  ["create-series", "Create series"],
  ["create-worlds", "Create games"],
  ["wait-for-factory-indexes", "Wait for Herald"],
] as const;

export const launchName = (kind: LaunchKind, request: LaunchJobRequest): string => {
  if (kind === "game" && "gameName" in request) return request.gameName;
  if (kind === "series" && "seriesName" in request) return request.seriesName;
  if (kind === "rotation" && "rotationName" in request) return request.rotationName;
  throw new Error(`Request does not match launch kind ${kind}`);
};

const publicStatus = (status: LaunchJobStatus): "running" | "attention" | "complete" =>
  status === "complete" ? "complete" : status === "failed" || status === "cancelled" ? "attention" : "running";

const stepStatus = (status: LaunchJobStatus, index: number): "pending" | "running" | "succeeded" | "failed" => {
  if (status === "complete") return "succeeded";
  if (index > 0) return "pending";
  return status === "failed" ? "failed" : "running";
};

export const toFactoryRunRecord = (run: LaunchRun) => {
  const summary = run.summary;
  const stepDefinitions = run.kind === "game" ? GAME_STEPS : GROUP_STEPS;
  const base = {
    version: 1,
    kind: run.kind,
    runId: run.id,
    environment: run.environment,
    chain: "madara",
    gameType: "blitz",
    status: publicStatus(run.status),
    executionMode: "fast_trial",
    requestedLaunchStep: "full",
    inputPath: `postgres://launch_runs/${run.id}`,
    latestLaunchRequestId: run.id,
    currentStepId: run.status === "complete" ? null : stepDefinitions[0][0],
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    workflow: { workflowName: "box-native" },
    steps: stepDefinitions.map(([id, title], index) => ({
      id,
      title,
      status: stepStatus(run.status, index),
      workflowStepName: title,
      latestEvent: run.errorMessage ?? (run.status === "complete" ? "Completed" : "Queued on the launch service"),
      ...(run.status === "failed" ? { errorMessage: run.errorMessage } : {}),
    })),
    recovery: {
      state: run.status === "complete" ? "complete" : run.status === "failed" ? "failed" : "active",
      canContinue: run.status === "failed",
      continueStepId: run.status === "failed" ? stepDefinitions[0][0] : null,
    },
  };

  if (run.kind === "game") {
    const game = summary && "gameName" in summary ? summary : undefined;
    return {
      ...base,
      gameName: run.name,
      artifacts: {
        summaryPath: game?.outputPath,
        durationSeconds: game?.durationSeconds,
        gameId: game?.gameId,
        worldAddress: game?.worldAddress,
        createGameTxHash: game?.createGameTxHash,
      },
    };
  }

  if (run.kind === "series") {
    const series = summary && "seriesName" in summary && !("rotationName" in summary) ? summary : undefined;
    return {
      ...base,
      seriesName: run.name,
      autoRetry: { enabled: true, intervalMinutes: series?.autoRetryIntervalMinutes ?? 15 },
      summary: series,
      artifacts: {
        summaryPath: series?.outputPath,
        seriesCreated: series?.seriesCreated,
        seriesCreatedAt: series?.seriesCreatedAt,
      },
    };
  }

  const rotation = summary && "rotationName" in summary ? summary : undefined;
  return {
    ...base,
    rotationName: run.name,
    seriesName: rotation?.seriesName ?? run.name,
    autoRetry: { enabled: true, intervalMinutes: rotation?.autoRetryIntervalMinutes ?? 15 },
    evaluation: { intervalMinutes: rotation?.evaluationIntervalMinutes ?? 30 },
    summary: rotation,
    artifacts: {
      summaryPath: rotation?.outputPath,
      seriesCreated: rotation?.seriesCreated,
      seriesCreatedAt: rotation?.seriesCreatedAt,
    },
  };
};
