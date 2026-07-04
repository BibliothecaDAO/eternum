import type { DeploymentEnvironment, RuntimeProvider } from "../types";

function parseRuntimeProvider(value: string | undefined, source: string): RuntimeProvider | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "aws" || normalized === "slot") {
    return normalized;
  }

  throw new Error(`Unsupported runtime provider "${value}" from ${source}`);
}

export function resolveRuntimeProvider(environment: DeploymentEnvironment): RuntimeProvider {
  return (
    parseRuntimeProvider(process.env.RUNTIME_PROVIDER_OVERRIDE, "RUNTIME_PROVIDER_OVERRIDE") ||
    parseRuntimeProvider(process.env.RUNTIME_PROVIDER, "RUNTIME_PROVIDER") ||
    environment.runtimeProvider
  );
}
