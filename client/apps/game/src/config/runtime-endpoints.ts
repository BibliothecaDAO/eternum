import {
  buildGameRuntimeAlias,
  buildGlobalRuntimeAlias,
  buildSharedChainRuntimeAlias,
  loadRuntimeRegistry,
  parseRuntimeRegistry,
  resolveRuntimeEndpointAlias,
  type RuntimeEndpointAlias,
  type RuntimeRegistryLoadResult,
  type RuntimeRegistryV1,
} from "../../../../../common/factory/runtime-registry";
import { env } from "../../env";

type RuntimeEndpointKind = RuntimeEndpointAlias["endpointKind"];

let parsedRegistry: RuntimeRegistryV1 | undefined;
let parsedRegistrySource: string | undefined;
let loadedRegistry: RuntimeRegistryV1 | undefined;

export async function loadConfiguredRuntimeRegistry(
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeRegistryLoadResult> {
  const result = await loadRuntimeRegistry({
    embedded: env.VITE_PUBLIC_RUNTIME_REGISTRY_JSON,
    fetchImpl,
    url: env.VITE_PUBLIC_RUNTIME_REGISTRY_URL,
  });
  loadedRegistry = result.registry;
  return result;
}

export function resolveConfiguredRuntimeRegistry(): RuntimeRegistryV1 | undefined {
  if (loadedRegistry) {
    return loadedRegistry;
  }

  const value = env.VITE_PUBLIC_RUNTIME_REGISTRY_JSON?.trim() || "";
  if (!value) {
    return undefined;
  }
  if (!parsedRegistry || parsedRegistrySource !== value) {
    parsedRegistry = parseRuntimeRegistry(value);
    parsedRegistrySource = value;
  }
  return parsedRegistry;
}

export function resolveGameRuntimeEndpoint(
  runtimeName: string,
  endpointKind: RuntimeEndpointKind = "base",
  options: { chain?: string; gameType?: "blitz" | "eternum" } = {},
): string {
  const environmentId = resolveRuntimeEnvironmentId(options.chain, options.gameType);
  return resolveRuntimeEndpointAlias(buildGameRuntimeAlias(environmentId, runtimeName, "torii", endpointKind), {
    registry: resolveConfiguredRuntimeRegistry(),
  });
}

export function resolveGlobalToriiEndpoint(chain: "mainnet" | "slot"): string {
  return resolveRuntimeEndpointAlias(buildGlobalRuntimeAlias(chain), {
    registry: resolveConfiguredRuntimeRegistry(),
  });
}

export function resolveChainRpcEndpoint(chain: string): string {
  const registryChain = chain === "local" ? "slot" : chain;
  return resolveRuntimeEndpointAlias(buildSharedChainRuntimeAlias(registryChain), {
    registry: resolveConfiguredRuntimeRegistry(),
  });
}

function resolveRuntimeEnvironmentId(chain?: string, gameType?: "blitz" | "eternum"): string {
  const selectedChain = chain || env.VITE_PUBLIC_CHAIN || "local";
  const registryChain = selectedChain === "local" ? "slot" : selectedChain;
  return `${registryChain}.${gameType || env.VITE_PUBLIC_GAME_TYPE || "blitz"}`;
}
