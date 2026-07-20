import { DEPLOYMENT_ENVIRONMENTS } from "./constants";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export function isDeploymentEnvironmentId(value: string): value is DeploymentEnvironmentId {
  return value in DEPLOYMENT_ENVIRONMENTS;
}

export function resolveDeploymentEnvironment(value: string): DeploymentEnvironment {
  if (!isDeploymentEnvironmentId(value)) {
    throw new Error(
      `Unsupported environment "${value}". Expected a provider-neutral local, sepolia, or mainnet environment; Slot identifiers are historical only`,
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

export function resolveAuthoritativeFactoryAddress(
  environment: DeploymentEnvironment,
  requestedAddress?: string,
): string {
  if (requestedAddress && !addressesMatch(requestedAddress, environment.factoryAddress)) {
    throw new Error(
      `Factory address for ${environment.id} must repeat the authoritative factory address ${environment.factoryAddress}`,
    );
  }

  return environment.factoryAddress;
}

function addressesMatch(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}
