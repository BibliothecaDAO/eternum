import {
  DEFAULT_APPCHAIN_ETERNUM_PRESET_ID,
  DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS,
  DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS,
  DEFAULT_APPCHAIN_PRESET_ID,
  DEFAULT_MADARA_PRESET_ID,
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
  devModeOn: boolean;
  singleRealmMode: boolean;
  twoPlayerMode: boolean;
  durationSeconds?: number;
  executionMode: "batched" | "sequential";
  verboseConfigLogs: boolean;
  version: string;
  waitForFactoryIndexTimeoutMs: number;
  waitForFactoryIndexPollMs: number;
  dryRun: boolean;
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
    | "devModeOn"
    | "singleRealmMode"
    | "twoPlayerMode"
    | "durationSeconds"
    | "mapConfigOverrides"
    | "biomeClimateOverrides"
    | "blitzRegistrationOverrides"
  >,
): number | undefined {
  const baseConfig = loadEnvironmentConfiguration(request.environmentId);
  const deploymentConfig = applyDeploymentConfigOverrides(baseConfig, {
    startMainAt: parseStartTime(request.startTime),
    factoryAddress: "",
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
    mapConfigOverrides: request.mapConfigOverrides,
    biomeClimateOverrides: request.biomeClimateOverrides,
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
      devModeOn: request.devModeOn,
      singleRealmMode: request.singleRealmMode,
      twoPlayerMode: request.twoPlayerMode,
      durationSeconds: request.durationSeconds,
      mapConfigOverrides: request.mapConfigOverrides,
      biomeClimateOverrides: request.biomeClimateOverrides,
      blitzRegistrationOverrides: request.blitzRegistrationOverrides,
    });

  return {
    rpcUrl: request.rpcUrl || environment.rpcUrl,
    devModeOn: request.devModeOn ?? false,
    singleRealmMode: request.singleRealmMode ?? false,
    twoPlayerMode: request.twoPlayerMode ?? false,
    durationSeconds: effectiveDurationSeconds,
    executionMode: request.executionMode || "batched",
    verboseConfigLogs: request.verboseConfigLogs === true,
    version:
      request.version ||
      String(
        environment.chain === "madara"
          ? DEFAULT_MADARA_PRESET_ID
          : environment.gameType === "eternum"
            ? DEFAULT_APPCHAIN_ETERNUM_PRESET_ID
            : DEFAULT_APPCHAIN_PRESET_ID,
      ),
    waitForFactoryIndexTimeoutMs: request.waitForFactoryIndexTimeoutMs ?? DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS,
    waitForFactoryIndexPollMs: request.waitForFactoryIndexPollMs ?? DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS,
    dryRun: request.dryRun === true,
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
      biomeClimateOverrides: game.biomeClimateOverrides,
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
    weeklyCadence: summary.weeklyCadence,
    biomeClimateOverridesByGameNumber: request.biomeClimateOverridesByGameNumber,
    targetGameNames: undefined,
    evaluationIntervalMinutes: summary.evaluationIntervalMinutes,
    autoRetryEnabled: summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
    resumeSummary: undefined,
  };
}
