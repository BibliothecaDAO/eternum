import type {
  Config as EternumConfig,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import type { Account } from "starknet";

export type DeploymentChain = "slot" | "mainnet";
export type DeploymentGameType = "blitz" | "eternum";
export type DeploymentEnvironmentId = "slot.blitz" | "slot.eternum" | "mainnet.blitz" | "mainnet.eternum";
export type ExecutionMode = "batched" | "sequential";
export type LaunchTargetKind = "game" | "series" | "rotation";
export type LaunchGameStepId =
  | "create-world"
  | "wait-for-factory-index"
  | "configure-world"
  | "grant-lootchest-role"
  | "grant-village-pass-role"
  | "create-banks"
  | "create-indexer"
  | "sync-paymaster";
export type SeriesLaunchStepId =
  | "create-series"
  | "create-worlds"
  | "wait-for-factory-indexes"
  | "configure-worlds"
  | "grant-lootchest-roles"
  | "grant-village-pass-roles"
  | "create-banks"
  | "create-indexers"
  | "sync-paymaster";
export type RotationLaunchStepId = SeriesLaunchStepId;
export type SeriesLaunchChildStepStatus = "pending" | "running" | "succeeded" | "failed";

export interface CreateGameDefaults {
  maxActions: number;
  submissionCount: number;
  retryCount: number;
  retryDelayMs: number;
}

export interface DeploymentEnvironment {
  id: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  toriiEnv: DeploymentChain;
  configPath: string;
  factoryAddress?: string;
  rpcUrl: string;
  accountAddress?: string;
  privateKey?: string;
  createGame: CreateGameDefaults;
}

export interface ConfigLogger {
  log: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
}

export interface CleanConfigContext<Provider = unknown> {
  account: Account;
  provider: Provider;
  config: EternumConfig;
  logger?: ConfigLogger;
}

export interface ConfigStep<Provider = unknown> {
  id: string;
  description: string;
  execute: (context: CleanConfigContext<Provider>) => Promise<void>;
}

export interface ExecutedConfigStep {
  id: string;
  description: string;
}

export interface ConfigExecutionResult {
  mode: ExecutionMode;
  steps: ExecutedConfigStep[];
  transactionHash?: string;
}

export interface ConfigStepHooks<Provider = unknown> {
  onStepStart?: (step: ConfigStep<Provider>, index: number, total: number) => void;
  onStepComplete?: (step: ConfigStep<Provider>, index: number, total: number, elapsedMs: number) => void;
}

export interface FactoryWorldProfile {
  worldAddress: string;
  contractsBySelector: Record<string, string>;
}

export type IndexerTier = "basic" | "pro" | "legendary" | "epic";
export type IndexerResolutionState = "existing" | "missing" | "indeterminate";
export type IndexerResolutionSource = "describe" | "describe-not-found" | "list" | "describe-and-list-failed";
export type IndexerCreationMode = "github-actions" | "slot-direct";

export interface IndexerRequest {
  env: string;
  rpcUrl: string;
  namespaces: string;
  worldName: string;
  worldAddress: string;
  tier?: IndexerTier;
  workflowFile?: string;
  ref?: string;
  externalContracts?: string[];
}

export interface IndexerWorkflowRun {
  workflowFile: string;
  ref: string;
  runId: number;
  runNumber: number;
  htmlUrl: string;
  status: string;
  conclusion: string;
}

export interface IndexerLiveState {
  state: IndexerResolutionState;
  stateSource: IndexerResolutionSource;
  currentTier?: IndexerTier;
  url?: string;
  version?: string;
  branch?: string;
  describeError?: string;
  describedAt?: string;
}

export interface IndexerCreationResult {
  mode: IndexerCreationMode;
  action?: "created" | "already-live";
  liveState?: IndexerLiveState;
  workflowRun?: IndexerWorkflowRun;
}

export interface LaunchGameRequest {
  launchKind?: "game";
  environmentId: DeploymentEnvironmentId;
  gameName: string;
  startTime: string | number;
  rpcUrl?: string;
  factoryAddress?: string;
  accountAddress?: string;
  privateKey?: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  cartridgeApiBase?: string;
  toriiNamespaces?: string;
  vrfProviderAddress?: string;
  executionMode?: ExecutionMode;
  verboseConfigLogs?: boolean;
  version?: string;
  maxActions?: number;
  seriesName?: string;
  seriesGameNumber?: number;
  waitForFactoryIndexTimeoutMs?: number;
  waitForFactoryIndexPollMs?: number;
  skipIndexer?: boolean;
  skipLootChestRoleGrant?: boolean;
  skipBanks?: boolean;
  dryRun?: boolean;
  workflowFile?: string;
  ref?: string;
}

export interface LaunchGameStepRequest extends LaunchGameRequest {
  stepId: LaunchGameStepId;
}

export interface LaunchSeriesGameRequest {
  gameName: string;
  startTime: string | number;
  seriesGameNumber?: number;
}

export interface LaunchSeriesRequest {
  launchKind?: "series";
  environmentId: DeploymentEnvironmentId;
  seriesName: string;
  games: LaunchSeriesGameRequest[];
  targetGameNames?: string[];
  rpcUrl?: string;
  factoryAddress?: string;
  accountAddress?: string;
  privateKey?: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  cartridgeApiBase?: string;
  toriiNamespaces?: string;
  vrfProviderAddress?: string;
  executionMode?: ExecutionMode;
  verboseConfigLogs?: boolean;
  version?: string;
  maxActions?: number;
  waitForFactoryIndexTimeoutMs?: number;
  waitForFactoryIndexPollMs?: number;
  skipIndexer?: boolean;
  skipLootChestRoleGrant?: boolean;
  skipBanks?: boolean;
  dryRun?: boolean;
  workflowFile?: string;
  ref?: string;
  autoRetryEnabled?: boolean;
  autoRetryIntervalMinutes?: number;
  resumeSummary?: LaunchSeriesSummary;
}

export interface LaunchSeriesStepRequest extends LaunchSeriesRequest {
  stepId: SeriesLaunchStepId;
}

export interface LaunchRotationRequest {
  launchKind?: "rotation";
  environmentId: DeploymentEnvironmentId;
  rotationName: string;
  firstGameStartTime: string | number;
  gameIntervalMinutes: number;
  maxGames: number;
  advanceWindowGames?: number;
  targetGameNames?: string[];
  evaluationIntervalMinutes: number;
  rpcUrl?: string;
  factoryAddress?: string;
  accountAddress?: string;
  privateKey?: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  cartridgeApiBase?: string;
  toriiNamespaces?: string;
  vrfProviderAddress?: string;
  executionMode?: ExecutionMode;
  verboseConfigLogs?: boolean;
  version?: string;
  maxActions?: number;
  waitForFactoryIndexTimeoutMs?: number;
  waitForFactoryIndexPollMs?: number;
  skipIndexer?: boolean;
  skipLootChestRoleGrant?: boolean;
  skipBanks?: boolean;
  dryRun?: boolean;
  workflowFile?: string;
  ref?: string;
  autoRetryEnabled?: boolean;
  autoRetryIntervalMinutes?: number;
  resumeSummary?: LaunchRotationSummary;
}

export interface LaunchRotationStepRequest extends LaunchRotationRequest {
  stepId: RotationLaunchStepId;
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
  factoryAddress: string;
  worldAddress?: string;
  createGameTxHash?: string;
  configureTxHash?: string;
  lootChestRoleTxHash?: string;
  villagePassRoleTxHash?: string;
  createBanksTxHash?: string;
  paymasterSynced?: boolean;
  indexerCreated: boolean;
  indexerMode?: IndexerCreationResult["mode"];
  indexerTier?: IndexerTier;
  indexerUrl?: string;
  indexerVersion?: string;
  indexerBranch?: string;
  lastIndexerDescribeAt?: string;
  indexerRequest?: IndexerRequest;
  indexerWorkflowRun?: IndexerWorkflowRun;
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
  worldAddress?: string;
  createGameTxHash?: string;
  configureTxHash?: string;
  lootChestRoleTxHash?: string;
  villagePassRoleTxHash?: string;
  createBanksTxHash?: string;
  paymasterSynced?: boolean;
  indexerCreated?: boolean;
  indexerMode?: IndexerCreationResult["mode"];
  indexerTier?: IndexerTier;
  indexerUrl?: string;
  indexerVersion?: string;
  indexerBranch?: string;
  lastIndexerDescribeAt?: string;
  pendingIndexerTierTarget?: IndexerTier;
  pendingIndexerTierRequestedAt?: string;
  lastIndexerTierDispatchTarget?: IndexerTier;
  lastIndexerTierDispatchFailedAt?: string;
  lastIndexerTierDispatchError?: string;
  indexerRequest?: IndexerRequest;
  indexerWorkflowRun?: IndexerWorkflowRun;
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
  factoryAddress: string;
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
  rpcUrl: string;
  factoryAddress: string;
  autoRetryEnabled: boolean;
  autoRetryIntervalMinutes: number;
  dryRun: boolean;
  configMode: ExecutionMode;
  seriesCreated: boolean;
  seriesCreatedAt?: string;
  games: SeriesLaunchGameSummary[];
  outputPath?: string;
}
