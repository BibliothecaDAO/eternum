import type { AccountInterface, FeeEstimate, ProviderInterface, RawCalldata } from "starknet";

export type SupportedNetwork = "local" | "sepolia" | "slot" | "slottest" | "mainnet";

export interface LoggerLike {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ClassMetadata {
  id: string;
  classHash: string;
  abi?: unknown;
  casm?: unknown;
  description?: string;
  tags?: string[];
}

export interface NetworkClassRegistry {
  network: SupportedNetwork;
  entries: Record<string, ClassMetadata>;
}

export interface ClassRegistry {
  get(network: SupportedNetwork, id: string): ClassMetadata | undefined;
  list(network: SupportedNetwork): ClassMetadata[];
  set(network: SupportedNetwork, entry: ClassMetadata): void;
  snapshot(): Record<SupportedNetwork, Record<string, ClassMetadata>>;
  require?(network: SupportedNetwork, id: string): ClassMetadata;
}

export interface ConstructorSpecification {
  entrypoint?: string;
  args?: Record<string, unknown>;
  raw?: RawCalldata;
}

export interface DeploymentModule {
  id: string;
  classId: string;
  dependsOn?: string[];
  constructor?: ConstructorSpecification;
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export interface GameDeploymentPreset {
  id: string;
  description?: string;
  modules: DeploymentModule[];
  metadata?: Record<string, unknown>;
}

export interface DeploymentStep {
  id: string;
  type: "declare" | "deploy" | "initialize";
  classId?: string;
  contractId?: string;
  dependsOn?: string[];
  labels?: string[];
  constructorCalldata?: RawCalldata;
  metadata?: Record<string, unknown>;
}

export interface DeploymentPlan {
  id: string;
  network: SupportedNetwork;
  steps: DeploymentStep[];
  presetId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DeploymentExecutionOptions {
  dryRun?: boolean;
  labels?: string[];
  metadata?: Record<string, unknown>;
  feeMultiplier?: number;
}

export interface DeploymentReceipt {
  stepId: string;
  type: DeploymentStep["type"];
  transactionHash?: string;
  contractAddress?: string;
  status: "pending" | "success" | "failed" | "skipped";
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface DeploymentExecutionResult {
  plan: DeploymentPlan;
  receipts: DeploymentReceipt[];
}

export interface DeploymentFeeEstimate {
  plan: DeploymentPlan;
  overall: FeeEstimate[];
  perStep: Record<string, FeeEstimate>;
}

export interface DeployedContractArtifact {
  id: string;
  address?: string;
  classHash: string;
  transactionHash?: string;
  constructorCalldata: RawCalldata | undefined;
  deployedAt: string;
  dependsOn: string[];
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export interface GameDeploymentArtifact {
  schemaVersion: 1;
  network: SupportedNetwork;
  presetId?: string;
  planId: string;
  createdAt: string;
  contracts: Record<string, DeployedContractArtifact>;
  registrySnapshot: Record<SupportedNetwork, Record<string, ClassMetadata>>;
  metadata?: Record<string, unknown>;
}

export interface GameDeploymentResult {
  plan: DeploymentPlan;
  artifact: GameDeploymentArtifact;
  receipts: DeploymentReceipt[];
}

export interface DeploymentExecutor {
  execute(plan: DeploymentPlan, options?: DeploymentExecutionOptions): Promise<DeploymentExecutionResult>;
  estimate(plan: DeploymentPlan, options?: DeploymentExecutionOptions): Promise<DeploymentFeeEstimate>;
}

export interface GameFactoryOptions {
  account: AccountInterface;
  provider?: ProviderInterface;
  registry?: ClassRegistry;
  logger?: LoggerLike;
  network: SupportedNetwork;
  artifactDirectory?: string;
  presets?: Record<string, GameDeploymentPreset>;
}

export interface DeployGameRequest {
  preset?: string | GameDeploymentPreset;
  plan?: DeploymentPlan;
  options?: DeploymentExecutionOptions;
  metadata?: Record<string, unknown>;
}

export interface EstimateDeployRequest extends DeployGameRequest {
  multiplier?: number;
}

export interface GameFactoryHooks {
  beforePlan?(request: DeployGameRequest): Promise<void> | void;
  afterPlan?(plan: DeploymentPlan): Promise<void> | void;
  beforeExecute?(plan: DeploymentPlan): Promise<void> | void;
  afterExecute?(result: GameDeploymentResult): Promise<void> | void;
}
