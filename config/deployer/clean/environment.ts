import { DEPLOYMENT_ENVIRONMENTS } from "./constants";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export function isDeploymentEnvironmentId(value: string): value is DeploymentEnvironmentId {
  return value in DEPLOYMENT_ENVIRONMENTS;
}

export function resolveDeploymentEnvironment(value: string): DeploymentEnvironment {
  if (!isDeploymentEnvironmentId(value)) {
    throw new Error(
      `Unsupported environment "${value}". Expected one of: mainnet.blitz, mainnet.eternum, slot.blitz, slot.eternum`,
    );
  }

  return DEPLOYMENT_ENVIRONMENTS[value];
}

export function isEternumDeploymentEnvironment(environment: DeploymentEnvironment): boolean {
  return environment.gameType === "eternum";
}

export function isMainnetDeploymentEnvironment(environment: DeploymentEnvironment): boolean {
  return environment.chain === "mainnet";
}
