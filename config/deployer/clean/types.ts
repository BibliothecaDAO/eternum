import type {
  FactoryBiomeClimateOverrides,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import type { GameChain } from "@realms-world/chain";

export type DeploymentChain = GameChain;
export type DeploymentGameType = "blitz" | "eternum";
export type DeploymentEnvironmentId = "madara.blitz" | "appchain.blitz" | "appchain.eternum";
export type ExecutionMode = "batched" | "sequential";
export type LaunchTargetKind = "game" | "series" | "rotation";
export type LaunchStepStatus = "pending" | "running" | "succeeded" | "failed";
export type LaunchRotationWeekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type LaunchGameStepId = "create-world" | "wait-for-factory-index";
export type SeriesLaunchStepId = "create-series" | "create-worlds" | "wait-for-factory-indexes";
export type RotationLaunchStepId = SeriesLaunchStepId;
// Backward-compatible names used by the workflow and run-store modules.
export type LaunchSeriesStepId = SeriesLaunchStepId;
export type LaunchRotationStepId = RotationLaunchStepId;
export type SeriesLaunchChildStepStatus = "pending" | "running" | "succeeded" | "failed";

export interface WorldDeployment {
  namespace: string;
  manifestPath: string;
  registrarAddress: string;
}

export interface DeploymentEnvironment {
  id: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  toriiEnv: DeploymentChain;
  configPath: string;
  rpcUrl: string;
  accountAddress?: string;
  privateKey?: string;
  world: WorldDeployment;
}

export interface LedgerLaunchOptions {
  ledgerAddress?: string;
  ledgerRpcUrl?: string;
  lordsAddress?: string;
  sponsoredPoolLords?: string;
}

export interface ExecutedConfigStep {
  id: string;
  description: string;
  transactionHash?: string;
}

export interface LaunchGameResumeStepState {
  id: LaunchGameStepId;
  status: LaunchStepStatus;
  latestEvent?: string;
}

export interface LaunchGameRequest extends LedgerLaunchOptions {
  launchKind?: "game";
  environmentId: DeploymentEnvironmentId;
  gameName: string;
  startTime: string | number;
  rpcUrl?: string;
  accountAddress?: string;
  privateKey?: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  executionMode?: ExecutionMode;
  verboseConfigLogs?: boolean;
  version?: string;
  seriesName?: string;
  seriesGameNumber?: number;
  waitForFactoryIndexTimeoutMs?: number;
  waitForFactoryIndexPollMs?: number;
  dryRun?: boolean;
  resumeSteps?: LaunchGameResumeStepState[];
}

export interface LaunchGameStepRequest extends LaunchGameRequest {
  stepId: LaunchGameStepId;
}

export interface LaunchSeriesGameRequest {
  gameName: string;
  startTime: string | number;
  seriesGameNumber?: number;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
}

export interface LaunchSeriesRequest extends LedgerLaunchOptions {
  launchKind?: "series";
  environmentId: DeploymentEnvironmentId;
  seriesName: string;
  games: LaunchSeriesGameRequest[];
  targetGameNames?: string[];
  rpcUrl?: string;
  accountAddress?: string;
  privateKey?: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  executionMode?: ExecutionMode;
  verboseConfigLogs?: boolean;
  version?: string;
  waitForFactoryIndexTimeoutMs?: number;
  waitForFactoryIndexPollMs?: number;
  dryRun?: boolean;
  autoRetryEnabled?: boolean;
  autoRetryIntervalMinutes?: number;
  resumeSummary?: LaunchSeriesSummary;
}

export interface LaunchSeriesStepRequest extends LaunchSeriesRequest {
  stepId: SeriesLaunchStepId;
}

export interface LaunchRotationRequest extends LedgerLaunchOptions {
  launchKind?: "rotation";
  environmentId: DeploymentEnvironmentId;
  rotationName: string;
  firstGameStartTime: string | number;
  gameIntervalMinutes: number;
  maxGames: number;
  advanceWindowGames?: number;
  targetGameNames?: string[];
  evaluationIntervalMinutes: number;
  weeklyCadence?: LaunchRotationWeeklyCadenceEntry[];
  rpcUrl?: string;
  accountAddress?: string;
  privateKey?: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  biomeClimateOverridesByGameNumber?: Record<number, FactoryBiomeClimateOverrides>;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  executionMode?: ExecutionMode;
  verboseConfigLogs?: boolean;
  version?: string;
  waitForFactoryIndexTimeoutMs?: number;
  waitForFactoryIndexPollMs?: number;
  dryRun?: boolean;
  autoRetryEnabled?: boolean;
  autoRetryIntervalMinutes?: number;
  resumeSummary?: LaunchRotationSummary;
}

export interface LaunchRotationStepRequest extends LaunchRotationRequest {
  stepId: RotationLaunchStepId;
}

export interface LaunchRotationWeeklyCadenceEntry {
  // Optional: entries without a prefix fall back to `<rotation-slug>-<number>` names.
  gameNamePrefix?: string;
  weekday: LaunchRotationWeekday;
  utcTime: string;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
}

export interface LaunchGameSummary {
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  gameName: string;
  startTime: number;
  startTimeIso: string;
  durationSeconds?: number;
  rpcUrl: string;
  gameId?: number;
  worldAddress?: string;
  createGameTxHash?: string;
  openLedgerTxHash?: string;
  sponsorLedgerTxHash?: string;
  prizeFunding?: PrizeFundingState;
  configMode: ExecutionMode;
  configSteps: ExecutedConfigStep[];
  dryRun: boolean;
  outputPath?: string;
}

export interface PrizeFundingTransfer {
  id: string;
  tokenAddress: string;
  amountRaw: string;
  amountDisplay: string;
  decimals: number;
  transactionHash: string;
  fundedAt: string;
}

export interface PrizeFundingState {
  transfers: PrizeFundingTransfer[];
}

export interface SeriesLaunchGameArtifacts {
  gameId?: number;
  worldAddress?: string;
  createGameTxHash?: string;
  openLedgerTxHash?: string;
  sponsorLedgerTxHash?: string;
  prizeFunding?: PrizeFundingState;
}

export interface SeriesLaunchGameStepState {
  id: SeriesLaunchStepId;
  status: SeriesLaunchChildStepStatus;
  latestEvent: string;
  updatedAt?: string;
  errorMessage?: string;
}

export interface SeriesLaunchGameSummary {
  gameName: string;
  startTime: number;
  startTimeIso: string;
  durationSeconds?: number;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  seriesGameNumber: number;
  currentStepId: SeriesLaunchStepId | null;
  latestEvent: string;
  status: SeriesLaunchChildStepStatus;
  configSteps: ExecutedConfigStep[];
  steps: SeriesLaunchGameStepState[];
  artifacts: SeriesLaunchGameArtifacts;
}

export interface LaunchSeriesSummary {
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  seriesName: string;
  rpcUrl: string;
  autoRetryEnabled: boolean;
  autoRetryIntervalMinutes: number;
  dryRun: boolean;
  configMode: ExecutionMode;
  seriesCreated: boolean;
  seriesCreatedAt?: string;
  games: SeriesLaunchGameSummary[];
  outputPath?: string;
}

export interface LaunchRotationSummary {
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  rotationName: string;
  seriesName: string;
  firstGameStartTime: number;
  firstGameStartTimeIso: string;
  gameIntervalMinutes: number;
  maxGames: number;
  advanceWindowGames: number;
  evaluationIntervalMinutes: number;
  weeklyCadence?: LaunchRotationWeeklyCadenceEntry[];
  rpcUrl: string;
  autoRetryEnabled: boolean;
  autoRetryIntervalMinutes: number;
  dryRun: boolean;
  configMode: ExecutionMode;
  seriesCreated: boolean;
  seriesCreatedAt?: string;
  games: SeriesLaunchGameSummary[];
  outputPath?: string;
}
