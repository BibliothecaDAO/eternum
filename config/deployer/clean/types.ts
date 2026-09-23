import type {
  FactoryBiomeClimateOverrides,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import type { ConfigurationNetwork } from "../../shared/game-environments";
import type { RegistrarWorld } from "./world/native/types";

export type DeploymentChain = ConfigurationNetwork;
export type DeploymentGameType = import("../../source/common/types").GameType;
export type DeploymentEnvironmentId = import("../../shared/game-environments").GameEnvironmentId;
export type ExecutionMode = "batched" | "sequential";
export type LaunchTargetKind = "game";
export type LaunchStepStatus = "pending" | "running" | "succeeded" | "failed";
export type LaunchGameStepId = "create-world" | "wait-for-factory-index";

export interface DeploymentEnvironment {
  id: DeploymentEnvironmentId;
  chain: DeploymentChain;
  gameType: DeploymentGameType;
  configPath: string;
  accountAddress?: string;
  privateKey?: string;
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

export interface LaunchGameRequest {
  /** The shard's world: the registrar and the chain the launch writes to. */
  manifest: RegistrarWorld;
  heraldUrl?: string;
  admissionUrl?: string;
  /** A Blitz game's players, as the gameplay accounts they play with. */
  rosterAccounts?: readonly string[];
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
  waitForFactoryIndexTimeoutMs?: number;
  waitForFactoryIndexPollMs?: number;
  dryRun?: boolean;
  resumeSteps?: LaunchGameResumeStepState[];
}

export interface LaunchGameStepRequest extends LaunchGameRequest {
  stepId: LaunchGameStepId;
}

export interface LaunchGameSummary {
  finalizeAt?: number;
  /** Transactions the Blitz roster settlement took at game start. */
  settlementTransactions?: number;
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
  configMode: ExecutionMode;
  configSteps: ExecutedConfigStep[];
  dryRun: boolean;
  outputPath?: string;
}
