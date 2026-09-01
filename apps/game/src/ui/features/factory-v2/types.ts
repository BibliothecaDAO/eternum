import type { GameChain } from "@realms-world/chain";
import type { FactoryBiomeClimateOverrides } from "@bibliothecadao/types";
import type { GameEnvironmentId } from "@config";

export type FactoryGameMode = "eternum" | "blitz";
export type FactoryLaunchChain = GameChain;
export type FactoryLaunchTargetKind = "game" | "series" | "rotation";
export type FactoryRunKind = "game" | "series" | "rotation";
export type FactoryRunStepId =
  | "launch-request"
  | "create-series"
  | "create-world"
  | "create-worlds"
  | "wait-for-factory-index"
  | "wait-for-factory-indexes";
export type FactoryRecoveryStepId =
  | "create-series"
  | "create-world"
  | "create-worlds"
  | "wait-for-factory-index"
  | "wait-for-factory-indexes";

export type FactoryRunStatus = "running" | "attention" | "waiting" | "complete";

export type FactoryStepStatus = "pending" | "running" | "succeeded" | "already_done" | "blocked" | "failed";
export type FactoryRunRecoveryState = "active" | "transitioning" | "stalled" | "failed" | "complete";
export type FactorySeriesChildStatus = "pending" | "running" | "succeeded" | "failed";
type FactoryWorkflowIntervalMinutes = 5 | 15 | 30 | 60;
export type FactorySeriesRetryIntervalMinutes = FactoryWorkflowIntervalMinutes;
export type FactoryRotationEvaluationIntervalMinutes = FactoryWorkflowIntervalMinutes;

export type FactoryWatcherKind =
  | "launch"
  | "continue"
  | "retry"
  | "refresh"
  | "delete_run"
  | "nudge"
  | "cancel_auto_retry"
  | "fund_prize";
export type FactoryPollingStatus = "idle" | "checking" | "live" | "paused";

export type FactoryLaunchStartRule = "next_hour";

export interface FactoryModeDefinition {
  id: FactoryGameMode;
  label: string;
}

export interface FactoryEnvironmentOption {
  id: GameEnvironmentId;
  label: string;
  mode: FactoryGameMode;
  chain: FactoryLaunchChain;
}

export interface FactoryLaunchPresetDefaults {
  startRule: FactoryLaunchStartRule;
  durationMinutes?: number;
  devMode: boolean;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
  /**
   * Registered registrar preset id the launch runs on. The same ids are
   * registered on every chain the factory serves; a launch without one uses
   * the launcher's per-chain default.
   */
  version?: string;
}

export interface FactoryLaunchPreset {
  id: string;
  mode: FactoryGameMode;
  name: string;
  description: string;
  defaults: FactoryLaunchPresetDefaults;
}

export interface FactoryDurationOption {
  value: number;
  label: string;
}

export interface FactoryRunStep {
  id: FactoryRunStepId;
  title: string;
  summary: string;
  workflowName: string;
  status: FactoryStepStatus;
  verification: string;
  latestEvent: string;
}

export interface FactorySeriesChildStep {
  id: FactoryRunStepId;
  status: FactoryStepStatus;
  latestEvent: string;
  errorMessage?: string;
}

export interface FactoryRunRecovery {
  state: FactoryRunRecoveryState;
  canContinue: boolean;
  continueStepId: FactoryRecoveryStepId | null;
}

export interface FactoryAutoRetryState {
  enabled: boolean;
  intervalMinutes: number;
  nextRetryAt: string | null;
  lastRetryAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface FactorySeriesGameDraft {
  id: string;
  gameName: string;
  startAt: string;
  seriesGameNumber: number;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
}

export interface FactoryRotationPreviewGame {
  id: string;
  gameName: string;
  startAt: string;
  seriesGameNumber: number;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
}

export interface FactorySeriesChildRun {
  id: string;
  gameName: string;
  seriesGameNumber: number;
  startTimeIso: string;
  status: FactorySeriesChildStatus;
  latestEvent: string;
  currentStepId: FactoryRunStepId | null;
  steps: FactorySeriesChildStep[];
  launchReady?: boolean;
  worldAddress?: string;
}

export interface FactoryRotationEvaluationState {
  intervalMinutes: number;
  nextEvaluationAt: string | null;
  lastEvaluatedAt: string | null;
  lastNudgedAt: string | null;
}

interface FactoryRotationWeeklyCadenceEntry {
  gameNamePrefix: string;
  weekday: string;
  utcTime: string;
}

export interface FactoryRotationRunState {
  rotationName: string;
  maxGames: number;
  advanceWindowGames: number;
  createdGameCount: number;
  queuedGameCount: number;
  gameIntervalMinutes: number;
  weeklyCadence?: FactoryRotationWeeklyCadenceEntry[];
  firstGameStartTimeIso: string;
}

export interface FactoryRun {
  id: string;
  syncKey: string;
  kind: FactoryRunKind;
  mode: FactoryGameMode;
  name: string;
  environment: GameEnvironmentId;
  owner: string;
  presetId: string;
  status: FactoryRunStatus;
  summary: string;
  updatedAt: string;
  worldAddress?: string;
  /** Registrar-assigned game id inside the persistent world. */
  gameId?: number;
  recovery?: FactoryRunRecovery;
  autoRetry?: FactoryAutoRetryState;
  evaluation?: FactoryRotationEvaluationState;
  rotation?: FactoryRotationRunState;
  children?: FactorySeriesChildRun[];
  steps: FactoryRunStep[];
}

export interface FactoryWatcherState {
  kind: FactoryWatcherKind;
  runName: string;
  title: string;
  detail: string;
  workflowName: string;
  statusLabel: string;
}

export interface FactoryPollingState {
  status: FactoryPollingStatus;
  detail: string;
  lastCheckedAt: number | null;
}

export interface FactoryActionFeedback {
  ok: boolean;
  message: string;
}
