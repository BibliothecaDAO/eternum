import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import type { GameEnvironmentId } from "../../../config/shared/game-environments";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";
import type { LaunchJobRequest, LaunchKind } from "./schemas";

export interface FinalizedGameSummary {
  environment: "madara.blitz";
  gameName: string;
  gameId: number;
  resultCommitment: string;
}

export type LaunchJobStatus = "queued" | "running" | "complete" | "failed";
export type LaunchSummary = LaunchGameSummary | FinalizedGameSummary;

export interface LaunchRun {
  id: string;
  /** The chain the run launches on or records results from, taken from the shard's /manifest when it was queued. */
  chainId: string;
  kind: LaunchKind;
  environment: GameEnvironmentId;
  name: string;
  request: LaunchJobRequest;
  status: LaunchJobStatus;
  attempts: number;
  /** When a queued run is next due: now for a new or retried run, its game's end for a result. */
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  summary?: LaunchSummary;
}

/** Where a run's request and summary live, as the factory page names them. */
export const launchRunPath = (runId: string) => `d1://launch_runs/${runId}`;

const GAME_STEPS = [
  ["create-world", "Create game"],
  ["wait-for-factory-index", "Wait for Herald"],
] as const;

export const launchName = (kind: LaunchKind, request: LaunchJobRequest): string => {
  if ("gameName" in request) return request.gameName;
  throw new Error(`Request does not match launch kind ${kind}`);
};

/** The stored status as the page shows it: a failed run asks a launcher's attention. */
const publicStatus = (status: LaunchJobStatus): Exclude<LaunchJobStatus, "failed"> | "attention" =>
  status === "failed" ? "attention" : status;

const stepStatus = (status: LaunchJobStatus, index: number): "pending" | "running" | "succeeded" | "failed" => {
  if (status === "complete") return "succeeded";
  if (index > 0 || status === "queued") return "pending";
  return status === "failed" ? "failed" : "running";
};

const latestEvent = (run: LaunchRun): string => {
  if (run.errorMessage) return run.errorMessage;
  if (run.status === "complete") return "Completed";
  return run.status === "queued" ? `Queued until ${run.dueAt}` : "Running on the launch service";
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
    gameType: resolveDeploymentEnvironment(run.environment).gameType,
    status: publicStatus(run.status),
    ...(run.status === "queued" ? { dueAt: run.dueAt } : {}),
    executionMode: "fast_trial",
    requestedLaunchStep: "full",
    inputPath: launchRunPath(run.id),
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
      latestEvent: latestEvent(run),
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
