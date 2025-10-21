import { createDeploymentExecutor } from "../deployment/executor";
import { createClassRegistry, registerPreset as registerGlobalPreset } from "../config";
import { buildDeploymentPlan } from "./deployment-plan";
import { createGameRegistry } from "../state/game-registry";
import { createConsoleLogger } from "../utils/logger";
import { isoNow } from "../utils/time";
import { ExecutionFailedError, FeeEstimationFailedError, GameFactoryError } from "../errors";
import type {
  DeployGameRequest,
  DeploymentExecutionResult,
  GameDeploymentArtifact,
  GameDeploymentResult,
  GameFactoryHooks,
  GameFactoryOptions,
  GameDeploymentPreset,
  DeployedContractArtifact,
  ClassRegistry,
  LoggerLike,
} from "../types";

const REGISTRY_SNAPSHOT_VERSION = 1;

const buildArtifact = (
  execution: DeploymentExecutionResult,
  registrySnapshot: GameDeploymentArtifact["registrySnapshot"],
): GameDeploymentArtifact => {
  const contracts: Record<string, DeployedContractArtifact> = {};
  for (const step of execution.plan.steps) {
    if (step.type !== "deploy") {
      continue;
    }

    const receipt = execution.receipts.find((item) => item.stepId === step.id);
    const networkRegistry = registrySnapshot[execution.plan.network] ?? {};
    const classMetadata = step.classId ? networkRegistry[step.classId] : undefined;

    contracts[step.id] = {
      id: step.contractId ?? step.id,
      address: receipt?.contractAddress,
      classHash: classMetadata?.classHash ?? "",
      transactionHash: receipt?.transactionHash,
      constructorCalldata: step.constructorCalldata,
      deployedAt: receipt?.finishedAt ?? isoNow(),
      dependsOn: step.dependsOn ?? [],
      labels: step.labels ? [...step.labels] : undefined,
      metadata: step.metadata,
    };
  }

  return {
    schemaVersion: REGISTRY_SNAPSHOT_VERSION,
    network: execution.plan.network,
    presetId: execution.plan.presetId,
    planId: execution.plan.id,
    createdAt: isoNow(),
    contracts,
    registrySnapshot,
    metadata: execution.plan.metadata,
  };
};

export class GameFactory {
  private readonly deploymentRegistry = createGameRegistry();
  private readonly classRegistry: ClassRegistry;
  private readonly logger: LoggerLike;
  private readonly hooks: GameFactoryHooks;
  private readonly customPresets: Map<string, GameDeploymentPreset>;

  constructor(private readonly options: GameFactoryOptions, hooks: GameFactoryHooks = {}) {
    this.classRegistry = options.registry ?? createClassRegistry();
    this.logger = options.logger ?? createConsoleLogger();
    this.hooks = hooks;
    this.customPresets = new Map(Object.entries(options.presets ?? {}));

    for (const preset of this.customPresets.values()) {
      registerGlobalPreset(preset);
    }
  }

  listDeployments() {
    return this.deploymentRegistry.list();
  }

  async deployGame(request: DeployGameRequest = {}): Promise<GameDeploymentResult> {
    try {
      await this.hooks.beforePlan?.(request);
      const preset = this.resolvePreset(request);

      const plan = buildDeploymentPlan({
        network: this.options.network,
        registry: this.classRegistry,
        preset,
        plan: request.plan,
        metadata: request.metadata,
      });

      await this.hooks.afterPlan?.(plan);
      await this.hooks.beforeExecute?.(plan);

      const executor = createDeploymentExecutor(this.options.account);
      const execution = await executor.execute(plan, request.options);

      const snapshot = this.classRegistry.snapshot();
      const artifact = buildArtifact(execution, snapshot);
      this.deploymentRegistry.register(artifact);

      await this.hooks.afterExecute?.({
        plan: execution.plan,
        artifact,
        receipts: execution.receipts,
      });

      return {
        plan: execution.plan,
        artifact,
        receipts: execution.receipts,
      };
    } catch (error) {
      this.logger.error("Deployment failed", { error });
      if (error instanceof GameFactoryError) {
        throw error;
      }
      throw new ExecutionFailedError("Failed to execute deployment plan.", { error });
    }
  }

  async estimateFees(request: DeployGameRequest = {}) {
    const preset = this.resolvePreset(request);
    const plan = buildDeploymentPlan({
      network: this.options.network,
      registry: this.classRegistry,
      preset,
      plan: request.plan,
      metadata: request.metadata,
    });

    const executor = createDeploymentExecutor(this.options.account);
    try {
      return await executor.estimate(plan, request.options);
    } catch (error) {
      throw new FeeEstimationFailedError("Failed to estimate deployment fees.", { error });
    }
  }

  async dryRun(request: DeployGameRequest = {}): Promise<GameDeploymentResult> {
    return this.deployGame({
      ...request,
      options: {
        ...request.options,
        dryRun: true,
      },
    });
  }

  private resolvePreset(request: DeployGameRequest): string | GameDeploymentPreset | undefined {
    if (request.plan) {
      return undefined;
    }

    if (!request.preset && this.customPresets.size > 0) {
      return this.customPresets.values().next().value;
    }

    if (typeof request.preset === "string" && this.customPresets.has(request.preset)) {
      return this.customPresets.get(request.preset);
    }

    return request.preset ?? "minimal";
  }
}
