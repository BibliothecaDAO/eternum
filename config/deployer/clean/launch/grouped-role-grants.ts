import { getGameManifest, type Chain } from "@contracts";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";
import { DEFAULT_CARTRIDGE_API_BASE } from "../constants";
import { buildVillagePassRoleGrantCalls, resolveVillagePassRoleGrantTarget } from "../eternum";
import { resolveDeploymentEnvironment } from "../environment";
import { patchManifestWithFactory, resolveFactoryWorldProfile } from "../factory/discovery";
import {
  buildLootChestMinterRoleGrantCall,
  grantRoles,
  resolveLootChestMinterRoleGrantTarget,
  type GrantRoleCall,
} from "../role-grants";
import { resolveAccountCredentials } from "../shared/credentials";
import type { GameManifestLike } from "../shared/manifest-types";
import type {
  LaunchRotationRequest,
  LaunchRotationSummary,
  LaunchSeriesRequest,
  LaunchSeriesSummary,
  SeriesLaunchGameSummary,
} from "../types";

type SeriesLikeRequest = LaunchSeriesRequest | LaunchRotationRequest;
type SeriesLikeSummary = LaunchSeriesSummary | LaunchRotationSummary;

interface SeriesLikeWorldManifestTarget {
  game: SeriesLaunchGameSummary;
  patchedManifest: GameManifestLike;
}

function resolveSeriesLikeCartridgeApiBase(request: SeriesLikeRequest): string {
  return request.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE;
}

function resolveSeriesLikeFirstStartTime(summary: SeriesLikeSummary): number {
  return "firstGameStartTime" in summary ? summary.firstGameStartTime : (summary.games[0]?.startTime ?? 0);
}

function resolveSeriesLikeDeploymentConfig(request: SeriesLikeRequest, summary: SeriesLikeSummary) {
  return applyDeploymentConfigOverrides(loadEnvironmentConfiguration(request.environmentId), {
    startMainAt: resolveSeriesLikeFirstStartTime(summary),
    factoryAddress: summary.factoryAddress,
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
    mapConfigOverrides: request.mapConfigOverrides,
    blitzRegistrationOverrides: request.blitzRegistrationOverrides,
  });
}

function resolveSeriesLikeGrantRoleCredentials(request: SeriesLikeRequest) {
  const environment = resolveDeploymentEnvironment(request.environmentId);

  return resolveAccountCredentials({
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    fallbackAccountAddress: environment.accountAddress,
    fallbackPrivateKey: environment.privateKey,
    context: `environment "${environment.id}"`,
  });
}

async function resolveSeriesLikeWorldManifestTargets(
  request: SeriesLikeRequest,
  games: SeriesLaunchGameSummary[],
): Promise<SeriesLikeWorldManifestTarget[]> {
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const chain = environment.chain as Chain;
  const cartridgeApiBase = resolveSeriesLikeCartridgeApiBase(request);
  const baseManifest = getGameManifest(chain) as GameManifestLike;

  return Promise.all(
    games.map(async (game) => {
      const worldProfile = await resolveFactoryWorldProfile(chain, game.gameName, cartridgeApiBase);
      if (!worldProfile?.worldAddress) {
        throw new Error(`Could not resolve factory deployment for "${game.gameName}" on "${chain}"`);
      }

      return {
        game,
        patchedManifest: patchManifestWithFactory(
          baseManifest,
          worldProfile.worldAddress,
          worldProfile.contractsBySelector,
        ),
      };
    }),
  );
}

function buildGroupedLootChestRoleGrantCalls(
  request: SeriesLikeRequest,
  summary: SeriesLikeSummary,
  targets: SeriesLikeWorldManifestTarget[],
): GrantRoleCall[] {
  if (request.skipLootChestRoleGrant) {
    return [];
  }

  const environment = resolveDeploymentEnvironment(request.environmentId);
  const deploymentConfig = resolveSeriesLikeDeploymentConfig(request, summary);

  return targets.flatMap((target) => {
    const roleGrantTarget = resolveLootChestMinterRoleGrantTarget({
      chain: environment.chain as Chain,
      config: deploymentConfig,
      patchedManifest: target.patchedManifest,
    });

    return roleGrantTarget ? [buildLootChestMinterRoleGrantCall(roleGrantTarget)] : [];
  });
}

async function buildGroupedVillagePassRoleGrantCalls(
  request: SeriesLikeRequest,
  games: SeriesLaunchGameSummary[],
): Promise<GrantRoleCall[]> {
  const chain = `${resolveDeploymentEnvironment(request.environmentId).chain}.eternum`;
  const cartridgeApiBase = resolveSeriesLikeCartridgeApiBase(request);

  const targets = await Promise.all(
    games.map((game) =>
      resolveVillagePassRoleGrantTarget({
        chain,
        gameName: game.gameName,
        rpcUrl: request.rpcUrl,
        cartridgeApiBase,
      }),
    ),
  );

  return targets.flatMap((target) => buildVillagePassRoleGrantCalls(target));
}

async function submitGroupedRoleGrantMulticall(params: {
  request: SeriesLikeRequest;
  rpcUrl: string;
  chain: string;
  calls: GrantRoleCall[];
}): Promise<string | undefined> {
  if (!params.calls.length) {
    return undefined;
  }

  const credentials = resolveSeriesLikeGrantRoleCredentials(params.request);
  const roleGrant = await grantRoles({
    chain: params.chain,
    calls: params.calls,
    rpcUrl: params.rpcUrl,
    accountAddress: credentials.accountAddress,
    privateKey: credentials.privateKey,
    context: `environment "${params.request.environmentId}"`,
    dryRun: params.request.dryRun,
  });

  return roleGrant.transactionHash;
}

export async function grantLootChestRolesForSeriesLikeGames(params: {
  request: SeriesLikeRequest;
  summary: SeriesLikeSummary;
  games: SeriesLaunchGameSummary[];
}): Promise<string | undefined> {
  const targets = await resolveSeriesLikeWorldManifestTargets(params.request, params.games);
  const calls = buildGroupedLootChestRoleGrantCalls(params.request, params.summary, targets);

  return submitGroupedRoleGrantMulticall({
    request: params.request,
    rpcUrl: params.summary.rpcUrl,
    chain: resolveDeploymentEnvironment(params.request.environmentId).chain,
    calls,
  });
}

export async function grantVillagePassRolesForSeriesLikeGames(params: {
  request: SeriesLikeRequest;
  summary: SeriesLikeSummary;
  games: SeriesLaunchGameSummary[];
}): Promise<string | undefined> {
  const calls = await buildGroupedVillagePassRoleGrantCalls(params.request, params.games);

  return submitGroupedRoleGrantMulticall({
    request: params.request,
    rpcUrl: params.summary.rpcUrl,
    chain: `${resolveDeploymentEnvironment(params.request.environmentId).chain}.eternum`,
    calls,
  });
}
