import type { Chain } from "@contracts";
import type { FactoryBiomeClimateOverrides } from "@bibliothecadao/types";

export type FactoryGameMode = "eternum" | "blitz";
export type FactoryLaunchChain = Extract<Chain, "mainnet" | "appchain">;
export type FactoryLaunchTargetKind = "game" | "series" | "rotation";
export type FactoryRunKind = "game" | "series" | "rotation";
export type FactoryRunStepId =
  | "launch-request"
  | "create-series"
  | "create-world"
  | "create-worlds"
  | "wait-factory-index"
  | "wait-for-factory-index"
  | "wait-for-factory-indexes"
  | "apply-config"
  | "configure-world"
  | "configure-worlds"
  | "grant-lootchest-role"
  | "grant-lootchest-roles"
  | "grant-village-pass"
  | "grant-village-pass-role"
  | "grant-village-pass-roles"
  | "create-banks"
  | "create-indexer"
  | "create-indexers"
  | "wait-indexer"
  | "sync-paymaster"
  | "publish-ready-state";
export type FactoryRecoveryStepId =
  | "create-series"
  | "create-world"
  | "create-worlds"
  | "wait-for-factory-index"
  | "wait-for-factory-indexes"
  | "configure-world"
  | "configure-worlds"
  | "grant-lootchest-role"
  | "grant-lootchest-roles"
  | "grant-village-pass-role"
  | "grant-village-pass-roles"
  | "create-banks"
  | "create-indexer"
  | "create-indexers"
  | "sync-paymaster";

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
  | "refresh_live_indexers"
  | "create_indexers"
  | "update_indexer_tier"
  | "reindex"
  | "delete_indexers"
  | "delete_run"
  | "nudge"
  | "cancel_auto_retry"
  | "fund_prize";
export type FactoryPollingStatus = "idle" | "checking" | "live" | "paused";

export type FactoryLaunchStartRule = "next_hour";

export interface FactoryModeDefinition {
  id: FactoryGameMode;
  label: string;
  strapline: string;
  description: string;
  accentClassName: string;
  focusLabel: string;
  stepPrinciples: string[];
}

export interface FactoryEnvironmentOption {
  id: string;
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
   * Registered on-chain preset id the launch runs on (appchain registrar):
   * "2" = Regular Fast rulebook, "3" = Duel balance. Legacy chains ignore it
   * and use their factory config version default.
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

export interface FactoryPrizeFundingTransfer {
  id: string;
  tokenAddress: string;
  amountRaw: string;
  amountDisplay: string;
  decimals: number;
  transactionHash: string;
  fundedAt: string;
}

export interface FactoryPrizeFundingState {
  transfers: FactoryPrizeFundingTransfer[];
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
  configReady?: boolean;
  worldAddress?: string;
  indexerCreated?: boolean;
  indexerTier?: string;
  prizeFunding?: FactoryPrizeFundingState;
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
  environment: string;
  owner: string;
  presetId: string;
  status: FactoryRunStatus;
  summary: string;
  updatedAt: string;
  worldAddress?: string;
  /** Registrar-assigned game id inside the persistent appchain world. */
  gameId?: number;
  recovery?: FactoryRunRecovery;
  autoRetry?: FactoryAutoRetryState;
  prizeFunding?: FactoryPrizeFundingState;
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
