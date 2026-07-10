import { DEFAULT_CARTRIDGE_API_BASE, DEFAULT_NAMESPACE } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { resolveFactoryWorldProfile } from "../factory/discovery";
import type { DeploymentEnvironmentId, IndexerRequest } from "../types";

function buildIndexerRequest(options: {
  environmentId: DeploymentEnvironmentId;
  gameName: string;
  runtimeInstanceId?: string;
  worldAddress: string;
  namespaces: string;
}): IndexerRequest {
  const environment = resolveDeploymentEnvironment(options.environmentId);

  return {
    env: environment.toriiEnv,
    environmentId: options.environmentId,
    runtimeProvider: environment.runtimeProvider,
    runtimeDomain: environment.runtimeDomain,
    rpcUrl: environment.rpcUrl,
    namespaces: options.namespaces,
    worldName: options.gameName,
    worldAddress: options.worldAddress,
    tier: "basic",
    externalContracts: [],
    runtimeInstanceId: options.runtimeInstanceId,
    imageDigest: process.env.AWS_RUNTIME_IMAGE_DIGEST,
    upstreamRpcSecretArn: process.env.AWS_RUNTIME_UPSTREAM_RPC_SECRET_ARN,
    exposurePolicy: "public-read",
    runtimeOwner: {
      runtimeInstanceId: options.runtimeInstanceId,
      gameName: options.gameName,
      runKind: "game",
      runName: options.gameName,
      autoTeardown: true,
      lifecycleClass: "ephemeral",
    },
  };
}

export async function resolveFactoryGameIndexerRequest(options: {
  environmentId: DeploymentEnvironmentId;
  gameName: string;
  runtimeInstanceId?: string;
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
    runtimeInstanceId: options.runtimeInstanceId,
    worldAddress: worldProfile.worldAddress,
    namespaces: options.toriiNamespaces || DEFAULT_NAMESPACE,
  });
}
