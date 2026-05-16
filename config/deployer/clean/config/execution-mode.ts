import type { DeploymentEnvironmentId, ExecutionMode } from "../types";

export function resolveDefaultConfigExecutionMode(environmentId: DeploymentEnvironmentId): ExecutionMode {
  return environmentId.startsWith("mainnet.") ? "sequential" : "batched";
}
