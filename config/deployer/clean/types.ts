import type { Config as EternumConfig } from "@bibliothecadao/types";
import type { Account } from "starknet";

export type DeploymentChain = "slot";
export type DeploymentGameType = "blitz" | "eternum";
export type DeploymentEnvironmentId = "slot.blitz" | "slot.eternum";
export type ExecutionMode = "batched" | "sequential";

export interface DeploymentEnvironment {
  id: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  toriiEnv: DeploymentChain;
  configPath: string;
  factoryAddress: string;
  rpcUrl: string;
  accountAddress: string;
  privateKey: string;
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

export interface IndexerRequest {
  env: string;
  rpcUrl: string;
  namespaces: string;
  worldName: string;
  worldAddress: string;
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

export interface IndexerCreationResult {
  mode: "github-actions";
  workflowRun?: IndexerWorkflowRun;
}

export interface LaunchGameRequest {
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

export interface LaunchGameSummary {
  environment: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  gameName: string;
  startTime: number;
  startTimeIso: string;
  rpcUrl: string;
  factoryAddress: string;
  worldAddress?: string;
  createGameTxHash?: string;
  configureTxHash?: string;
  lootChestRoleTxHash?: string;
  villagePassRoleTxHash?: string;
  createBanksTxHash?: string;
  indexerCreated: boolean;
  indexerMode?: IndexerCreationResult["mode"];
  indexerRequest?: IndexerRequest;
  indexerWorkflowRun?: IndexerWorkflowRun;
  configMode: ExecutionMode;
  configSteps: ExecutedConfigStep[];
  dryRun: boolean;
  outputPath?: string;
}
