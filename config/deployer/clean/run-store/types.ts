import type { DeploymentChain, DeploymentEnvironmentId, DeploymentGameType, IndexerWorkflowRun, LaunchGameRequest, LaunchGameStepId } from "../types";

export type LaunchWorkflowScope = "full" | LaunchGameStepId;
export type FactoryRunExecutionMode = "fast_trial" | "guided_recovery";
export type FactoryRunStatus = "running" | "attention" | "complete";
export type FactoryRunStepStatus = "pending" | "running" | "succeeded" | "failed";

export interface FactoryRunWorkflowContext {
  workflowName: string;
  workflowJob?: string;
  workflowRunId?: number;
  workflowRunAttempt?: number;
  workflowUrl?: string;
  ref?: string;
  sha?: string;
}

export interface FactoryRunLease {
  launchRequestId: string;
  workflowRunId?: number;
  workflowRunAttempt?: number;
  stepId: LaunchGameStepId;
  acquiredAt: string;
  expiresAt: string;
}

export interface FactoryRunArtifacts {
  summaryPath?: string;
  worldAddress?: string;
  createGameTxHash?: string;
  configureTxHash?: string;
  lootChestRoleTxHash?: string;
  villagePassRoleTxHash?: string;
  createBanksTxHash?: string;
  indexerCreated?: boolean;
  indexerWorkflowRun?: IndexerWorkflowRun;
}

export interface FactoryRunStepRecord {
  id: LaunchGameStepId;
  title: string;
  status: FactoryRunStepStatus;
  workflowStepName: string;
  latestEvent: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface FactoryLaunchInputRecord {
  version: 1;
  runId: string;
  launchRequestId: string;
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  gameName: string;
  executionMode: FactoryRunExecutionMode;
  requestedLaunchStep: LaunchWorkflowScope;
  createdAt: string;
  workflow: FactoryRunWorkflowContext;
  request: LaunchGameRequest;
}

export interface FactoryRunRecord {
  version: 1;
  runId: string;
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  gameName: string;
  status: FactoryRunStatus;
  executionMode: FactoryRunExecutionMode;
  requestedLaunchStep: LaunchWorkflowScope;
  inputPath: string;
  latestLaunchRequestId: string;
  currentStepId: LaunchGameStepId | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workflow: FactoryRunWorkflowContext;
  activeLease?: FactoryRunLease;
  steps: FactoryRunStepRecord[];
  artifacts: FactoryRunArtifacts;
}

export interface FactoryRunIdentity {
  environmentId: DeploymentEnvironmentId;
  gameName: string;
}

export interface FactoryRunRequestContext extends FactoryRunIdentity {
  request: LaunchGameRequest;
  requestedLaunchStep: LaunchWorkflowScope;
}

export interface FactoryRunStoreEventContext extends FactoryRunRequestContext {
  launchRequestId: string;
  inputPath: string;
  executionMode: FactoryRunExecutionMode;
  timestamp: string;
  workflow: FactoryRunWorkflowContext;
}
