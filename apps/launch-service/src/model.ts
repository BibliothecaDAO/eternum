import type { GameEnvironmentId } from "../../../config/shared/game-environments";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";
import type { LaunchJobRequest, LaunchKind } from "./schemas";

export interface FinalizedGameSummary {
  environment: "madara.blitz";
  gameName: string;
  gameId: number;
  resultCommitment: string;
}

export type LaunchJobStatus = "queued" | "running" | "complete" | "failed" | "cancelled";
export type LaunchSummary = LaunchGameSummary | FinalizedGameSummary;

export interface LaunchRun {
  id: string;
  kind: LaunchKind;
  environment: GameEnvironmentId;
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

export const launchName = (kind: LaunchKind, request: LaunchJobRequest): string => {
  if ("gameName" in request) return request.gameName;
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
  const stepDefinitions = run.kind === "game" ? GAME_STEPS : ([["finalize-results", "Finalize results"]] as const);
  const base = {
    version: 1,
    kind: run.kind,
    runId: run.id,
    environment: run.environment,
    chain: "madara",
    gameType: run.environment === "madara.eternum" ? "eternum" : "blitz",
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

  const game = summary && "startTime" in summary ? summary : undefined;
  const result = summary && "resultCommitment" in summary ? summary : undefined;
  return {
    ...base,
    gameName: run.name,
    artifacts: {
      summaryPath: game?.outputPath,
      durationSeconds: game?.durationSeconds,
      gameId: game?.gameId ?? result?.gameId,
      worldAddress: game?.worldAddress,
      createGameTxHash: game?.createGameTxHash,
      resultCommitment: result?.resultCommitment,
    },
  };
};
