import {
  buildFactoryRuntimeAlias,
  buildGameRuntimeAlias,
  buildSharedChainRuntimeAlias,
  getDefaultRuntimeRegistry,
  loadRuntimeRegistry,
  parseRuntimeRegistry,
  resolveRuntimeEndpointAlias,
  type RuntimeRegistryLoadResult,
  type RuntimeRegistryV1,
} from "../../../../../common/factory/runtime-registry";

let loadedRegistry: RuntimeRegistryV1 | undefined;
let parsedRegistry: RuntimeRegistryV1 | undefined;
let parsedRegistrySource: string | undefined;

export async function loadConfiguredRuntimeRegistry(
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeRegistryLoadResult> {
  const result = await loadRuntimeRegistry({
    embedded: process.env.RUNTIME_REGISTRY_JSON,
    fetchImpl,
    url: process.env.RUNTIME_REGISTRY_URL,
  });
  loadedRegistry = result.registry;
  return result;
}

export function resolveFactoryToriiSqlEndpoint(chain: string): string {
  return resolveAlias(buildFactoryRuntimeAlias(chain, "eternum"));
}

export function resolveGameToriiEndpoint(
  worldName: string,
  endpointKind: "base" | "health" | "rpc" | "sql",
  chain?: string,
): string {
  for (const environmentId of resolveCandidateEnvironments(chain)) {
    const alias = buildGameRuntimeAlias(environmentId, worldName, "torii", endpointKind);
    if (hasAlias(alias)) {
      return resolveAlias(alias);
    }
  }
  throw new Error(`Runtime registry has no Torii ${endpointKind} alias for "${worldName}"`);
}

export function resolveChainRpcEndpoint(chain: string): string {
  const registryChain = chain === "local" ? "slot" : chain;
  return resolveAlias(buildSharedChainRuntimeAlias(registryChain));
}

function resolveAlias(alias: string): string {
  const registry = resolveConfiguredRegistry();
  if (registry?.aliases[alias]) {
    return resolveRuntimeEndpointAlias(alias, { registry });
  }
  return resolveRuntimeEndpointAlias(alias, { registry: getDefaultRuntimeRegistry() });
}

function hasAlias(alias: string): boolean {
  return Boolean(resolveConfiguredRegistry()?.aliases[alias] || getDefaultRuntimeRegistry().aliases[alias]);
}

function resolveConfiguredRegistry(): RuntimeRegistryV1 | undefined {
  if (loadedRegistry) {
    return loadedRegistry;
  }

  const value = process.env.RUNTIME_REGISTRY_JSON?.trim();
  if (!value) {
    return undefined;
  }
  if (!parsedRegistry || parsedRegistrySource !== value) {
    parsedRegistry = parseRuntimeRegistry(value);
    parsedRegistrySource = value;
  }
  return parsedRegistry;
}

function resolveCandidateEnvironments(chain?: string): string[] {
  const configuredEnvironment = process.env.RUNTIME_DEFAULT_ENVIRONMENT_ID?.trim();
  if (configuredEnvironment) {
    return [configuredEnvironment];
  }

  const selectedChain = chain || process.env.RUNTIME_DEFAULT_CHAIN || "slot";
  const registryChain = selectedChain === "local" ? "slot" : selectedChain;
  return [`${registryChain}.blitz`, `${registryChain}.eternum`];
}
