import {
  DEFAULT_CARTRIDGE_API_BASE,
  DEFAULT_FACTORY_INDEX_POLL_MS,
  DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
  DEFAULT_NAMESPACE,
  DEFAULT_VERSION,
  DEFAULT_VRF_PROVIDER_ADDRESS,
} from "../constants";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config";
import { resolveDeploymentEnvironment } from "../environment";
import { parseStartTime } from "../launch/time";
import type {
  LaunchGameRequest,
  LaunchRotationRequest,
  LaunchRotationSummary,
  LaunchSeriesRequest,
  LaunchSeriesSummary,
} from "../types";
import { resolveDefaultRotationRetryIntervalMinutes } from "../launch/rotation-summary";
import { resolveDefaultSeriesRetryIntervalMinutes } from "../launch/series-summary";

interface SeriesLikeGameDuration {
  durationSeconds?: number;
}

interface ResolvedPersistedSharedLaunchRequest {
  rpcUrl: string;
  factoryAddress: string;
  devModeOn: boolean;
  singleRealmMode: boolean;
  twoPlayerMode: boolean;
  durationSeconds?: number;
  cartridgeApiBase: string;
  toriiNamespaces: string;
  vrfProviderAddress: string;
  executionMode: "batched" | "sequential";
  verboseConfigLogs: boolean;
  version: string;
  maxActions: number;
  waitForFactoryIndexTimeoutMs: number;
  waitForFactoryIndexPollMs: number;
  skipIndexer: boolean;
  skipLootChestRoleGrant: boolean;
  skipBanks: boolean;
  dryRun: boolean;
  workflowFile?: string;
  ref?: string;
}

function isResolvedDurationSeconds(value: number | undefined): value is number {
  return Number.isFinite(value);
}

function resolvePersistedSeriesLikeDurationSeconds(
  games: SeriesLikeGameDuration[],
  fallbackDurationSeconds: number | undefined,
): number | undefined {
  const configuredChildDurationSeconds = games.find((game) =>
    isResolvedDurationSeconds(game.durationSeconds),
  )?.durationSeconds;

  return configuredChildDurationSeconds ?? fallbackDurationSeconds;
}

function resolveEffectiveLaunchDurationSeconds(
  request: Pick<
    LaunchGameRequest,
    | "environmentId"
    | "startTime"
    | "factoryAddress"
    | "devModeOn"
    | "singleRealmMode"
    | "twoPlayerMode"
    | "durationSeconds"
    | "mapConfigOverrides"
    | "blitzRegistrationOverrides"
  >,
): number | undefined {
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const baseConfig = loadEnvironmentConfiguration(request.environmentId);
  const deploymentConfig = applyDeploymentConfigOverrides(baseConfig, {
    startMainAt: parseStartTime(request.startTime),
    factoryAddress: request.factoryAddress || environment.factoryAddress || "",
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
    mapConfigOverrides: request.mapConfigOverrides,
    blitzRegistrationOverrides: request.blitzRegistrationOverrides,
  });

  return deploymentConfig.season?.durationSeconds;
}

function buildPersistedSharedLaunchRequest(
  request: LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest,
  startTime: string | number,
  durationSecondsOverride?: number,
): ResolvedPersistedSharedLaunchRequest {
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const effectiveDurationSeconds =
    durationSecondsOverride ??
    resolveEffectiveLaunchDurationSeconds({
      environmentId: request.environmentId,
      startTime,
      factoryAddress: request.factoryAddress,
      devModeOn: request.devModeOn,
      singleRealmMode: request.singleRealmMode,
      twoPlayerMode: request.twoPlayerMode,
      durationSeconds: request.durationSeconds,
      mapConfigOverrides: request.mapConfigOverrides,
      blitzRegistrationOverrides: request.blitzRegistrationOverrides,
    });

  return {
    rpcUrl: request.rpcUrl || environment.rpcUrl,
    factoryAddress: request.factoryAddress || environment.factoryAddress || "",
    devModeOn: request.devModeOn ?? false,
    singleRealmMode: request.singleRealmMode ?? false,
    twoPlayerMode: request.twoPlayerMode ?? false,
    durationSeconds: effectiveDurationSeconds,
    cartridgeApiBase: request.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE,
    toriiNamespaces: request.toriiNamespaces || DEFAULT_NAMESPACE,
    vrfProviderAddress: request.vrfProviderAddress || DEFAULT_VRF_PROVIDER_ADDRESS,
    executionMode: request.executionMode || "batched",
    verboseConfigLogs: request.verboseConfigLogs === true,
    version: request.version || DEFAULT_VERSION,
    maxActions: request.maxActions ?? environment.createGame.maxActions,
    waitForFactoryIndexTimeoutMs: request.waitForFactoryIndexTimeoutMs ?? DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
    waitForFactoryIndexPollMs: request.waitForFactoryIndexPollMs ?? DEFAULT_FACTORY_INDEX_POLL_MS,
    skipIndexer: request.skipIndexer === true,
    skipLootChestRoleGrant: request.skipLootChestRoleGrant === true,
    skipBanks: request.skipBanks === true,
    dryRun: request.dryRun === true,
    workflowFile: request.workflowFile,
    ref: request.ref,
  };
}

export function buildPersistedGameLaunchRequest(request: LaunchGameRequest): LaunchGameRequest {
  return {
    ...request,
    ...buildPersistedSharedLaunchRequest(request, request.startTime),
    accountAddress: undefined,
    privateKey: undefined,
  };
}

export function buildPersistedSeriesLaunchRequest(
  request: LaunchSeriesRequest,
  summary: LaunchSeriesSummary,
): LaunchSeriesRequest {
  return {
    ...request,
    ...buildPersistedSharedLaunchRequest(
      request,
      request.games[0]?.startTime ?? summary.games[0]?.startTime ?? Date.now(),
      resolvePersistedSeriesLikeDurationSeconds(summary.games, request.durationSeconds),
    ),
    accountAddress: undefined,
    privateKey: undefined,
    seriesName: summary.seriesName,
    autoRetryEnabled: summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultSeriesRetryIntervalMinutes(request),
    games: summary.games.map((game) => ({
      gameName: game.gameName,
      startTime: game.startTime,
      seriesGameNumber: game.seriesGameNumber,
    })),
    targetGameNames: undefined,
    resumeSummary: undefined,
  };
}

export function buildPersistedRotationLaunchRequest(
  request: LaunchRotationRequest,
  summary: LaunchRotationSummary,
): LaunchRotationRequest {
  return {
    ...request,
    ...buildPersistedSharedLaunchRequest(
      request,
      request.firstGameStartTime,
      resolvePersistedSeriesLikeDurationSeconds(summary.games, request.durationSeconds),
    ),
    accountAddress: undefined,
    privateKey: undefined,
    rotationName: summary.rotationName,
    firstGameStartTime: summary.firstGameStartTime,
    gameIntervalMinutes: summary.gameIntervalMinutes,
    maxGames: summary.maxGames,
    advanceWindowGames: summary.advanceWindowGames,
    targetGameNames: undefined,
    evaluationIntervalMinutes: summary.evaluationIntervalMinutes,
    autoRetryEnabled: summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
    resumeSummary: undefined,
  };
}
