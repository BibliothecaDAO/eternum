import type {
  DeploymentChain,
  DeploymentEnvironmentId,
  DeploymentGameType,
  IndexerWorkflowRun,
  LaunchGameRequest,
  LaunchGameStepId,
  LaunchRotationRequest,
  LaunchRotationStepId,
  LaunchRotationSummary,
  LaunchSeriesRequest,
  LaunchSeriesStepId,
  LaunchSeriesSummary,
  PrizeFundingState,
} from "../types";

export type LaunchWorkflowScope = "full" | LaunchGameStepId;
export type SeriesLaunchWorkflowScope = "full" | LaunchSeriesStepId;
export type RotationLaunchWorkflowScope = "full" | LaunchRotationStepId;
export type FactoryRunKind = "game" | "series" | "rotation";
export type FactoryMaintenanceIndexKind = FactoryRunKind;
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

export interface FactoryAccountLeaseOwner {
  environment: DeploymentEnvironmentId;
  gameName: string;
  launchRequestId: string;
  workflowName: string;
  workflowRunId?: number;
  workflowRunAttempt?: number;
  stepId: LaunchGameStepId;
  leaseId: string;
}

export interface FactoryAccountLeaseRecord {
  version: 1;
  chain: DeploymentChain;
  accountAddress: string;
  owner: FactoryAccountLeaseOwner;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
  releasedAt?: string;
}

export interface FactoryRunLease {
  launchRequestId: string;
  workflowRunId?: number;
  workflowRunAttempt?: number;
  stepId: LaunchGameStepId;
  acquiredAt: string;
  expiresAt: string;
}

export interface FactorySeriesRunLease {
  launchRequestId: string;
  workflowRunId?: number;
  workflowRunAttempt?: number;
  stepId: LaunchSeriesStepId;
  acquiredAt: string;
  expiresAt: string;
}

export interface FactoryRotationRunLease {
  launchRequestId: string;
  workflowRunId?: number;
  workflowRunAttempt?: number;
  stepId: LaunchRotationStepId;
  acquiredAt: string;
  expiresAt: string;
}

export interface FactoryRunArtifacts {
  summaryPath?: string;
  scheduledStartTime?: string | number;
  durationSeconds?: number;
  worldAddress?: string;
  createGameTxHash?: string;
  configureTxHash?: string;
  lootChestRoleTxHash?: string;
  villagePassRoleTxHash?: string;
  createBanksTxHash?: string;
  paymasterSynced?: boolean;
  indexerCreated?: boolean;
  indexerTier?: string;
  pendingIndexerTierTarget?: string;
  pendingIndexerTierRequestedAt?: string;
  indexerWorkflowRun?: IndexerWorkflowRun;
  prizeFunding?: PrizeFundingState;
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

export interface FactorySeriesRunStepRecord {
  id: LaunchSeriesStepId;
  title: string;
  status: FactoryRunStepStatus;
  workflowStepName: string;
  latestEvent: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface FactoryRotationRunStepRecord {
  id: LaunchRotationStepId;
  title: string;
  status: FactoryRunStepStatus;
  workflowStepName: string;
  latestEvent: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface FactorySeriesAutoRetryState {
  enabled: boolean;
  intervalMinutes: number;
  nextRetryAt?: string;
  lastRetryAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface FactoryRotationEvaluationState {
  intervalMinutes: number;
  nextEvaluationAt?: string;
  lastEvaluatedAt?: string;
  lastNudgedAt?: string;
}

export interface FactoryLaunchInputRecord {
  version: 1;
  kind: "game";
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

export interface FactorySeriesLaunchInputRecord {
  version: 1;
  kind: "series";
  runId: string;
  launchRequestId: string;
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  seriesName: string;
  executionMode: FactoryRunExecutionMode;
  requestedLaunchStep: SeriesLaunchWorkflowScope;
  createdAt: string;
  workflow: FactoryRunWorkflowContext;
  request: LaunchSeriesRequest;
}

export interface FactoryRotationLaunchInputRecord {
  version: 1;
  kind: "rotation";
  runId: string;
  launchRequestId: string;
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  rotationName: string;
  executionMode: FactoryRunExecutionMode;
  requestedLaunchStep: RotationLaunchWorkflowScope;
  createdAt: string;
  workflow: FactoryRunWorkflowContext;
  request: LaunchRotationRequest;
}

export interface FactoryRunRecord {
  version: 1;
  kind: "game";
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

export interface FactorySeriesRunRecord {
  version: 1;
  kind: "series";
  runId: string;
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  seriesName: string;
  status: FactoryRunStatus;
  executionMode: FactoryRunExecutionMode;
  requestedLaunchStep: SeriesLaunchWorkflowScope;
  inputPath: string;
  latestLaunchRequestId: string;
  currentStepId: LaunchSeriesStepId | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workflow: FactoryRunWorkflowContext;
  activeLease?: FactorySeriesRunLease;
  autoRetry: FactorySeriesAutoRetryState;
  steps: FactorySeriesRunStepRecord[];
  summary: LaunchSeriesSummary;
  artifacts: {
    summaryPath?: string;
    seriesCreated?: boolean;
    seriesCreatedAt?: string;
  };
}

export interface FactoryRotationRunRecord {
  version: 1;
  kind: "rotation";
  runId: string;
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  rotationName: string;
  seriesName: string;
  status: FactoryRunStatus;
  executionMode: FactoryRunExecutionMode;
  requestedLaunchStep: RotationLaunchWorkflowScope;
  inputPath: string;
  latestLaunchRequestId: string;
  currentStepId: LaunchRotationStepId | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workflow: FactoryRunWorkflowContext;
  activeLease?: FactoryRotationRunLease;
  autoRetry: FactorySeriesAutoRetryState;
  evaluation: FactoryRotationEvaluationState;
  steps: FactoryRotationRunStepRecord[];
  summary: LaunchRotationSummary;
  artifacts: {
    summaryPath?: string;
    seriesCreated?: boolean;
    seriesCreatedAt?: string;
  };
}

export interface FactoryRunMaintenanceArtifacts {
  indexerCreated?: boolean;
  indexerTier?: string;
  pendingIndexerTierTarget?: string;
  pendingIndexerTierRequestedAt?: string;
}

export interface FactoryRunMaintenanceIndexGame {
  gameName: string;
  startTime?: string | number;
  durationSeconds?: number;
  artifacts: FactoryRunMaintenanceArtifacts;
}

interface FactoryRunMaintenanceIndexEntryBase {
  kind: FactoryMaintenanceIndexKind;
  environment: DeploymentEnvironmentId;
  path: string;
  inputPath?: string;
  status: FactoryRunStatus;
  updatedAt: string;
  workflowRef?: string;
  currentStepId: string | null;
  activeLeaseExpiresAt?: string;
  hasRunningStep: boolean;
  recoverableFailedStepId?: string | null;
  recoverablePendingStepId?: string | null;
}

export interface FactoryGameRunMaintenanceIndexEntry extends FactoryRunMaintenanceIndexEntryBase {
  kind: "game";
  gameName: string;
  startTime?: string | number;
  durationSeconds?: number;
  artifacts: FactoryRunMaintenanceArtifacts;
}

export interface FactorySeriesRunMaintenanceIndexEntry extends FactoryRunMaintenanceIndexEntryBase {
  kind: "series";
  seriesName: string;
  autoRetry: FactorySeriesAutoRetryState;
  games: FactoryRunMaintenanceIndexGame[];
}

export interface FactoryRotationRunMaintenanceIndexEntry extends FactoryRunMaintenanceIndexEntryBase {
  kind: "rotation";
  rotationName: string;
  autoRetry: FactorySeriesAutoRetryState;
  evaluation: FactoryRotationEvaluationState;
  games: FactoryRunMaintenanceIndexGame[];
}

export type FactoryRunMaintenanceIndexEntry =
  | FactoryGameRunMaintenanceIndexEntry
  | FactorySeriesRunMaintenanceIndexEntry
  | FactoryRotationRunMaintenanceIndexEntry;

export interface FactoryRunMaintenanceIndexRecord {
  version: 1;
  environment: DeploymentEnvironmentId;
  kind: FactoryMaintenanceIndexKind;
  updatedAt: string;
  entries: Record<string, FactoryRunMaintenanceIndexEntry>;
}

export interface FactoryRunIdentity {
  environmentId: DeploymentEnvironmentId;
  gameName: string;
}

export interface FactorySeriesRunIdentity {
  environmentId: DeploymentEnvironmentId;
  seriesName: string;
}

export interface FactoryRotationRunIdentity {
  environmentId: DeploymentEnvironmentId;
  rotationName: string;
}

export interface FactoryAccountLeaseIdentity {
  environmentId: DeploymentEnvironmentId;
  accountAddress: string;
}

export interface FactoryRunRequestContext extends FactoryRunIdentity {
  request: LaunchGameRequest;
  requestedLaunchStep: LaunchWorkflowScope;
}

export interface FactorySeriesRunRequestContext extends FactorySeriesRunIdentity {
  request: LaunchSeriesRequest;
  requestedLaunchStep: SeriesLaunchWorkflowScope;
}

export interface FactoryRotationRunRequestContext extends FactoryRotationRunIdentity {
  request: LaunchRotationRequest;
  requestedLaunchStep: RotationLaunchWorkflowScope;
}

export interface FactoryRunStoreEventContext extends FactoryRunRequestContext {
  launchRequestId: string;
  inputPath: string;
  executionMode: FactoryRunExecutionMode;
  timestamp: string;
  workflow: FactoryRunWorkflowContext;
}

export interface FactorySeriesRunStoreEventContext extends FactorySeriesRunRequestContext {
  launchRequestId: string;
  inputPath: string;
  executionMode: FactoryRunExecutionMode;
  timestamp: string;
  workflow: FactoryRunWorkflowContext;
}

export interface FactoryRotationRunStoreEventContext extends FactoryRotationRunRequestContext {
  launchRequestId: string;
  inputPath: string;
  executionMode: FactoryRunExecutionMode;
  timestamp: string;
  workflow: FactoryRunWorkflowContext;
}

export interface FactoryAccountLeaseRequestContext extends FactoryRunIdentity {
  accountAddress: string;
  stepId: LaunchGameStepId;
  leaseId?: string;
}
