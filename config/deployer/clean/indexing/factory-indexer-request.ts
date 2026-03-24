import { DEFAULT_CARTRIDGE_API_BASE, DEFAULT_NAMESPACE } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { resolveFactoryWorldProfile } from "../factory/discovery";
import type { DeploymentEnvironmentId, IndexerRequest } from "../types";

function buildIndexerRequest(options: {
  environmentId: DeploymentEnvironmentId;
  gameName: string;
  worldAddress: string;
  namespaces: string;
}): IndexerRequest {
  const environment = resolveDeploymentEnvironment(options.environmentId);

  return {
    env: environment.toriiEnv,
    rpcUrl: environment.rpcUrl,
    namespaces: options.namespaces,
    worldName: options.gameName,
    worldAddress: options.worldAddress,
    tier: "basic",
    externalContracts: [],
  };
}

export async function resolveFactoryGameIndexerRequest(options: {
  environmentId: DeploymentEnvironmentId;
  gameName: string;
  cartridgeApiBase?: string;
  toriiNamespaces?: string;
}): Promise<IndexerRequest> {
  const environment = resolveDeploymentEnvironment(options.environmentId);
  const cartridgeApiBase = options.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE;
  const worldProfile = await resolveFactoryWorldProfile(environment.chain, options.gameName, cartridgeApiBase);

  if (!worldProfile?.worldAddress) {
    throw new Error(`Could not resolve a factory world for ${options.environmentId}/${options.gameName}`);
  }

  return buildIndexerRequest({
    environmentId: options.environmentId,
    gameName: options.gameName,
    worldAddress: worldProfile.worldAddress,
    namespaces: options.toriiNamespaces || DEFAULT_NAMESPACE,
  });
}
