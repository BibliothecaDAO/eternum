import type { DeploymentEnvironment, RuntimeProvider } from "../types";

function parseRuntimeProvider(value: string | undefined, source: string): RuntimeProvider | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "aws") {
    return "aws";
  }

  if (normalized === "slot") {
    throw new Error(`Slot is a historical read-only provider and cannot be selected from ${source}`);
  }

  throw new Error(`Unsupported runtime provider "${value}" from ${source}`);
}

export function resolveRuntimeProvider(environment: DeploymentEnvironment): RuntimeProvider {
  const provider =
    parseRuntimeProvider(process.env.RUNTIME_PROVIDER_OVERRIDE, "RUNTIME_PROVIDER_OVERRIDE") ||
    parseRuntimeProvider(process.env.RUNTIME_PROVIDER, "RUNTIME_PROVIDER") ||
    environment.runtimeProvider;
  if (provider !== "aws") {
    throw new Error(
      `Environment "${environment.id}" uses historical Slot runtime state and cannot launch new runtimes`,
    );
  }
  return provider;
}
