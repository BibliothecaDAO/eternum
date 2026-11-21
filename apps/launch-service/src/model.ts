import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import type { GameEnvironmentId } from "../../../config/shared/game-environments";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";
import { isCalendarFrontier, type CreateGameRequest } from "./schemas";

export type LaunchJobStatus = "queued" | "running" | "complete" | "failed";

export interface LaunchRun {
  id: string;
  chainId: string;
  environment: GameEnvironmentId;
  name: string;
  request: CreateGameRequest;
  status: LaunchJobStatus;
  attempts: number;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  summary?: LaunchGameSummary;
}

/** Where a run's request and summary live, as the factory page names them. */
export const launchRunPath = (runId: string) => `d1://launch_runs/${runId}`;

const GAME_STEPS = [
  ["create-world", "Create game"],
  ["wait-for-factory-index", "Wait for Herald"],
] as const;

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
  const base = {
    version: 1,
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
    currentStepId: run.status === "complete" ? null : GAME_STEPS[0][0],
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    workflow: { workflowName: "box-native" },
    steps: GAME_STEPS.map(([id, title], index) => ({
      id,
      title,
      status: stepStatus(run.status, index),
      workflowStepName: title,
      latestEvent: latestEvent(run),
      ...(run.status === "failed" ? { errorMessage: run.errorMessage } : {}),
    })),
    recovery: {
      state: run.status === "complete" ? "complete" : run.status === "failed" ? "failed" : "active",
      canDelete:
        run.status !== "running" && run.status !== "complete" && !isCalendarFrontier(run.environment, run.name),
      canContinue: run.status === "failed",
      continueStepId: run.status === "failed" ? GAME_STEPS[0][0] : null,
    },
  };

  return {
    ...base,
    gameName: run.name,
    artifacts: {
      summaryPath: summary?.outputPath,
      durationSeconds: summary?.durationSeconds,
      gameId: summary?.gameId,
      worldAddress: summary?.worldAddress,
      createGameTxHash: summary?.createGameTxHash,
    },
  };
};
