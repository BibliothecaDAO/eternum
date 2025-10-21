import { MissingClassHashError, PlanValidationError, PresetNotFoundError } from "../errors";
import { buildConstructorCalldata } from "../deployment/call-data";
import { getPreset, hasPreset } from "../config/presets";
import type {
  ClassRegistry,
  DeploymentPlan,
  DeploymentStep,
  GameDeploymentPreset,
  SupportedNetwork,
} from "../types";

export interface BuildDeploymentPlanParams {
  network: SupportedNetwork;
  registry: ClassRegistry;
  preset?: string | GameDeploymentPreset;
  plan?: DeploymentPlan;
  metadata?: Record<string, unknown>;
}

const validatePlan = (plan: DeploymentPlan) => {
  const seen = new Set<string>();
  for (const step of plan.steps) {
    if (seen.has(step.id)) {
      throw new PlanValidationError(`Duplicate step id "${step.id}" found in deployment plan.`, {
        stepId: step.id,
      });
    }
    seen.add(step.id);
  }
};

const resolvePreset = (preset: string | GameDeploymentPreset | undefined): GameDeploymentPreset | undefined => {
  if (!preset) {
    return undefined;
  }
  if (typeof preset !== "string") {
    return preset;
  }
  if (!hasPreset(preset)) {
    throw new PresetNotFoundError(preset);
  }
  return getPreset(preset);
};

export const buildDeploymentPlan = (params: BuildDeploymentPlanParams): DeploymentPlan => {
  if (params.plan) {
    const plan: DeploymentPlan = {
      ...params.plan,
      network: params.network,
      metadata: {
        ...params.plan.metadata,
        ...params.metadata,
      },
    };
    validatePlan(plan);
    return plan;
  }

  const preset = resolvePreset(params.preset);
  if (!preset) {
    throw new PlanValidationError("Either a preset or an explicit plan must be provided.");
  }

  const steps: DeploymentStep[] = preset.modules.map((module) => {
    const metadata = params.registry.require
      ? params.registry.require(params.network, module.classId)
      : params.registry.get(params.network, module.classId);

    if (!metadata) {
      throw new MissingClassHashError(module.classId, params.network);
    }

    const constructorCalldata = buildConstructorCalldata(metadata, module.constructor);

    return {
      id: module.id,
      type: "deploy",
      classId: module.classId,
      contractId: module.id,
      dependsOn: module.dependsOn,
      labels: module.labels,
      constructorCalldata,
      metadata: module.metadata,
    };
  });

  const plan: DeploymentPlan = {
    id: `plan:${preset.id}`,
    network: params.network,
    steps,
    presetId: preset.id,
    metadata: {
      ...preset.metadata,
      ...params.metadata,
    },
  };

  validatePlan(plan);
  return plan;
};
