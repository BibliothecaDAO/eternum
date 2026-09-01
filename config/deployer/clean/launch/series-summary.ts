import { resolveDeploymentEnvironment } from "../environment";
import type {
  LaunchSeriesGameRequest,
  LaunchSeriesRequest,
  LaunchSeriesStepId,
  LaunchSeriesSummary,
  SeriesLaunchGameStepState,
  SeriesLaunchGameSummary,
} from "../types";
import { resolveSeriesLaunchStepIds } from "./series-plan";
import { fileLaunchRunStore, type LaunchRunStore } from "./run-store";
import { parseStartTime, toIsoUtc } from "./time";
import { requireRpcUrl } from "../shared/rpc";

export const DEFAULT_SERIES_AUTO_RETRY_INTERVAL_MINUTES = 15;

export function resolveDefaultSeriesRetryIntervalMinutes(request: LaunchSeriesRequest): number {
  return request.autoRetryIntervalMinutes ?? DEFAULT_SERIES_AUTO_RETRY_INTERVAL_MINUTES;
}

export function validateSeriesLaunchRequest(request: LaunchSeriesRequest): void {
  if (!request.seriesName.trim()) {
    throw new Error("Series name is required");
  }

  if (request.games.length === 0) {
    throw new Error("At least one game is required for a series launch");
  }

  const requestedGameNames = new Set<string>();
  for (const game of request.games) {
    validateSeriesLaunchGameRequest(game);
    const normalizedGameName = game.gameName.trim();
    if (requestedGameNames.has(normalizedGameName)) {
      throw new Error(`Series game "${normalizedGameName}" was requested more than once`);
    }
    requestedGameNames.add(normalizedGameName);
  }
}

function validateSeriesLaunchGameRequest(game: LaunchSeriesGameRequest): void {
  if (!game.gameName.trim()) {
    throw new Error("Each series game needs a game name");
  }

  parseStartTime(game.startTime);
}

function buildInitialSeriesGameStepStates(stepIds: LaunchSeriesStepId[]): SeriesLaunchGameStepState[] {
  return stepIds.map((stepId) => ({
    id: stepId,
    status: "pending",
    latestEvent: "Waiting to run",
  }));
}

function buildSeriesGameSummary(
  game: LaunchSeriesGameRequest,
  stepIds: LaunchSeriesStepId[],
  defaultDurationSeconds: number | undefined,
): SeriesLaunchGameSummary {
  const parsedStartTime = parseStartTime(game.startTime);

  return {
    gameName: game.gameName,
    startTime: parsedStartTime,
    startTimeIso: toIsoUtc(parsedStartTime),
    durationSeconds: defaultDurationSeconds,
    ...(game.biomeClimateOverrides ? { biomeClimateOverrides: game.biomeClimateOverrides } : {}),
    seriesGameNumber: 0,
    currentStepId: null,
    latestEvent: "Waiting to run",
    status: "pending",
    configSteps: [],
    steps: buildInitialSeriesGameStepStates(stepIds),
    artifacts: {},
  };
}

export function buildInitialSeriesLaunchSummary(request: LaunchSeriesRequest): LaunchSeriesSummary {
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const stepIds = resolveSeriesLaunchStepIds(request.environmentId);

  return {
    environment: request.environmentId,
    chain: environment.chain,
    gameType: environment.gameType,
    seriesName: request.seriesName.trim(),
    rpcUrl: requireRpcUrl(request.rpcUrl, "RPC_URL"),
    autoRetryEnabled: request.autoRetryEnabled ?? true,
    autoRetryIntervalMinutes: resolveDefaultSeriesRetryIntervalMinutes(request),
    dryRun: request.dryRun === true,
    configMode: request.executionMode || "batched",
    seriesCreated: false,
    games: request.games.map((game) => buildSeriesGameSummary(game, stepIds, request.durationSeconds)),
  };
}

function applySeriesRequestSettings(summary: LaunchSeriesSummary, request: LaunchSeriesRequest): LaunchSeriesSummary {
  return {
    ...summary,
    rpcUrl: requireRpcUrl(request.rpcUrl || summary.rpcUrl, "RPC_URL"),
    autoRetryEnabled: request.autoRetryEnabled ?? summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultSeriesRetryIntervalMinutes(request),
    dryRun: request.dryRun === true,
    configMode: request.executionMode || summary.configMode,
  };
}

function validateExistingSeriesGameAppend(
  existingGame: SeriesLaunchGameSummary,
  requestedGame: LaunchSeriesGameRequest,
): void {
  const requestedStartTime = parseStartTime(requestedGame.startTime);
  if (existingGame.startTime !== requestedStartTime) {
    throw new Error(`Series game "${existingGame.gameName}" already exists and cannot be changed by append`);
  }
}

function appendRequestedSeriesGames(summary: LaunchSeriesSummary, request: LaunchSeriesRequest): LaunchSeriesSummary {
  const requestedStepIds = resolveSeriesLaunchStepIds(request.environmentId);
  const existingGamesByName = new Map(summary.games.map((game) => [game.gameName, game]));
  const appendedGames: SeriesLaunchGameSummary[] = [];

  for (const requestedGame of request.games) {
    const normalizedGameName = requestedGame.gameName.trim();
    const existingGame = existingGamesByName.get(normalizedGameName);
    if (existingGame) {
      validateExistingSeriesGameAppend(existingGame, requestedGame);
      continue;
    }

    appendedGames.push(
      buildSeriesGameSummary(
        {
          ...requestedGame,
          gameName: normalizedGameName,
        },
        requestedStepIds,
        request.durationSeconds,
      ),
    );
  }

  return applySeriesRequestSettings(
    {
      ...summary,
      games: [...summary.games, ...appendedGames],
    },
    request,
  );
}

function validatePersistedSeriesGameNumbers(summary: LaunchSeriesSummary): void {
  const assignedGameNumbers = new Set<number>();

  for (const game of summary.games) {
    if (game.seriesGameNumber <= 0) {
      continue;
    }

    if (assignedGameNumbers.has(game.seriesGameNumber)) {
      throw new Error(
        `Series summary for "${summary.seriesName}" contains duplicate game number ${game.seriesGameNumber}`,
      );
    }

    assignedGameNumbers.add(game.seriesGameNumber);
  }
}

export async function assignSeriesGameNumbers(
  _request: LaunchSeriesRequest,
  summary: LaunchSeriesSummary,
): Promise<LaunchSeriesSummary> {
  validatePersistedSeriesGameNumbers(summary);

  if (summary.games.every((game) => game.seriesGameNumber > 0)) {
    return summary;
  }

  const lastGameNumber = Math.max(0, ...summary.games.map((game) => game.seriesGameNumber));
  let nextGameNumber =
    Math.max(lastGameNumber, ...summary.games.map((game) => (game.seriesGameNumber > 0 ? game.seriesGameNumber : 0))) +
    1;

  return {
    ...summary,
    seriesCreated: summary.seriesCreated,
    games: summary.games.map((game) => {
      if (game.seriesGameNumber > 0) {
        nextGameNumber = Math.max(nextGameNumber, game.seriesGameNumber + 1);
        return game;
      }

      const assignedGameNumber = nextGameNumber;
      nextGameNumber += 1;

      return {
        ...game,
        seriesGameNumber: assignedGameNumber,
      };
    }),
  };
}

export async function hydrateSeriesLaunchSummary(
  request: LaunchSeriesRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchSeriesSummary> {
  if (request.resumeSummary) {
    return assignSeriesGameNumbers(request, applySeriesRequestSettings(request.resumeSummary, request));
  }

  const existingSummary = await store.loadSeries(request.environmentId, request.seriesName.trim());
  if (existingSummary) {
    return assignSeriesGameNumbers(request, appendRequestedSeriesGames(existingSummary, request));
  }

  return assignSeriesGameNumbers(request, buildInitialSeriesLaunchSummary(request));
}

export const persistSeriesLaunchSummary = (
  summary: LaunchSeriesSummary,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchSeriesSummary> => store.saveSeries(summary);
