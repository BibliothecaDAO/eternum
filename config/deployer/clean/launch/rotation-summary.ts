import { DEFAULT_CARTRIDGE_API_BASE } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { readFactorySeriesState } from "../factory/series";
import type {
  LaunchRotationRequest,
  LaunchRotationSummary,
  RotationLaunchStepId,
  SeriesLaunchGameStepState,
  SeriesLaunchGameSummary,
} from "../types";
import { loadRotationLaunchSummaryIfPresent, writeRotationLaunchSummary } from "./rotation-io";
import { resolveSeriesLaunchStepIds } from "./series-plan";
import { parseStartTime, toIsoUtc } from "./time";

export const DEFAULT_ROTATION_AUTO_RETRY_INTERVAL_MINUTES = 15;
export const DEFAULT_ROTATION_ADVANCE_WINDOW_GAMES = 5;

export function resolveDefaultRotationRetryIntervalMinutes(request: LaunchRotationRequest): number {
  return request.autoRetryIntervalMinutes ?? DEFAULT_ROTATION_AUTO_RETRY_INTERVAL_MINUTES;
}

export function resolveRotationAdvanceWindowGames(request: LaunchRotationRequest): number {
  return Math.min(Math.max(request.advanceWindowGames ?? DEFAULT_ROTATION_ADVANCE_WINDOW_GAMES, 1), 5);
}

export function validateRotationLaunchRequest(request: LaunchRotationRequest): void {
  if (!request.rotationName.trim()) {
    throw new Error("Rotation name is required");
  }

  validateRotationPositiveInteger(request.gameIntervalMinutes, "game interval minutes");
  validateRotationPositiveInteger(request.maxGames, "max games");
  validateRotationPositiveInteger(request.evaluationIntervalMinutes, "evaluation interval minutes");
  validateRotationPositiveInteger(resolveRotationAdvanceWindowGames(request), "advance window games");

  if (resolveRotationAdvanceWindowGames(request) > request.maxGames) {
    throw new Error("Advance window games cannot be greater than max games");
  }

  parseStartTime(request.firstGameStartTime);
}

function validateRotationPositiveInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function buildInitialRotationGameStepStates(stepIds: RotationLaunchStepId[]): SeriesLaunchGameStepState[] {
  return stepIds.map((stepId) => ({
    id: stepId,
    status: "pending",
    latestEvent: "Waiting to run",
  }));
}

function buildRotationGameSummary(
  rotationName: string,
  seriesGameNumber: number,
  startTime: number,
  stepIds: RotationLaunchStepId[],
  defaultDurationSeconds: number | undefined,
): SeriesLaunchGameSummary {
  return {
    gameName: buildRotationGameName(rotationName, seriesGameNumber),
    startTime,
    startTimeIso: toIsoUtc(startTime),
    durationSeconds: defaultDurationSeconds,
    seriesGameNumber,
    currentStepId: null,
    latestEvent: "Waiting to run",
    status: "pending",
    configSteps: [],
    steps: buildInitialRotationGameStepStates(stepIds),
    artifacts: {},
  };
}

function buildRotationGameName(rotationName: string, seriesGameNumber: number): string {
  const slug = rotationName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "rotation"}-${String(seriesGameNumber).padStart(2, "0")}`;
}

export function buildInitialRotationLaunchSummary(request: LaunchRotationRequest): LaunchRotationSummary {
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const firstGameStartTime = parseStartTime(request.firstGameStartTime);

  return {
    environment: request.environmentId,
    chain: environment.chain,
    gameType: environment.gameType,
    rotationName: request.rotationName.trim(),
    seriesName: request.rotationName.trim(),
    firstGameStartTime,
    firstGameStartTimeIso: toIsoUtc(firstGameStartTime),
    gameIntervalMinutes: request.gameIntervalMinutes,
    maxGames: request.maxGames,
    advanceWindowGames: resolveRotationAdvanceWindowGames(request),
    evaluationIntervalMinutes: request.evaluationIntervalMinutes,
    rpcUrl: request.rpcUrl || environment.rpcUrl,
    factoryAddress: request.factoryAddress || environment.factoryAddress || "",
    autoRetryEnabled: request.autoRetryEnabled ?? true,
    autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
    dryRun: request.dryRun === true,
    configMode: request.executionMode || "batched",
    seriesCreated: false,
    games: [],
  };
}

function applyRotationRequestSettings(
  summary: LaunchRotationSummary,
  request: LaunchRotationRequest,
): LaunchRotationSummary {
  return {
    ...summary,
    rpcUrl: request.rpcUrl || summary.rpcUrl,
    factoryAddress: request.factoryAddress || summary.factoryAddress,
    autoRetryEnabled: request.autoRetryEnabled ?? summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
    dryRun: request.dryRun === true,
    configMode: request.executionMode || summary.configMode,
  };
}

function validatePersistedRotationGameNumbers(summary: LaunchRotationSummary): void {
  const assignedGameNumbers = new Set<number>();

  for (const game of summary.games) {
    if (game.seriesGameNumber <= 0) {
      continue;
    }

    if (assignedGameNumbers.has(game.seriesGameNumber)) {
      throw new Error(
        `Rotation summary for "${summary.rotationName}" contains duplicate game number ${game.seriesGameNumber}`,
      );
    }

    assignedGameNumbers.add(game.seriesGameNumber);
  }
}

async function assignRotationGameNumbers(
  request: LaunchRotationRequest,
  summary: LaunchRotationSummary,
): Promise<LaunchRotationSummary> {
  validatePersistedRotationGameNumbers(summary);

  if (summary.games.every((game) => game.seriesGameNumber > 0)) {
    return summary;
  }

  const seriesState = await readFactorySeriesState({
    chain: summary.chain,
    seriesName: summary.seriesName,
    cartridgeApiBase: request.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE,
  });
  let nextGameNumber =
    Math.max(
      seriesState.lastGameNumber,
      ...summary.games.map((game) => (game.seriesGameNumber > 0 ? game.seriesGameNumber : 0)),
    ) + 1;

  return {
    ...summary,
    seriesCreated: summary.seriesCreated || seriesState.exists,
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
        gameName: buildRotationGameName(summary.rotationName, assignedGameNumber),
      };
    }),
  };
}

function resolveNextRotationStartTime(summary: LaunchRotationSummary, nowSeconds: number): number {
  const lastPlannedStartTime = summary.games.at(-1)?.startTime;
  if (lastPlannedStartTime) {
    return lastPlannedStartTime + summary.gameIntervalMinutes * 60;
  }

  if (summary.firstGameStartTime >= nowSeconds) {
    return summary.firstGameStartTime;
  }

  const intervalSeconds = summary.gameIntervalMinutes * 60;
  const elapsedSeconds = nowSeconds - summary.firstGameStartTime;
  const skippedIntervals = Math.floor(elapsedSeconds / intervalSeconds) + 1;
  return summary.firstGameStartTime + skippedIntervals * intervalSeconds;
}

function resolveRotationGamesToAdd(summary: LaunchRotationSummary, nowSeconds: number): number {
  const remainingCapacity = Math.max(summary.maxGames - summary.games.length, 0);
  if (remainingCapacity === 0) {
    return 0;
  }

  const futureGames = summary.games.filter((game) => game.startTime > nowSeconds);
  const missingAdvanceWindow = Math.max(summary.advanceWindowGames - futureGames.length, 0);
  return Math.min(remainingCapacity, missingAdvanceWindow);
}

export function reconcileRotationLaunchSummary(
  request: LaunchRotationRequest,
  summary: LaunchRotationSummary,
  now = Date.now(),
): LaunchRotationSummary {
  const nowSeconds = Math.floor(now / 1000);
  const gamesToAdd = resolveRotationGamesToAdd(summary, nowSeconds);

  if (gamesToAdd === 0) {
    return applyRotationRequestSettings(summary, request);
  }

  const stepIds = resolveSeriesLaunchStepIds(request.environmentId);
  const nextGames = [...summary.games];
  let nextGameNumber = Math.max(0, ...nextGames.map((game) => game.seriesGameNumber));
  let nextStartTime = resolveNextRotationStartTime(summary, nowSeconds);

  for (let index = 0; index < gamesToAdd; index += 1) {
    nextGameNumber += 1;
    nextGames.push(
      buildRotationGameSummary(summary.rotationName, nextGameNumber, nextStartTime, stepIds, request.durationSeconds),
    );
    nextStartTime += summary.gameIntervalMinutes * 60;
  }

  return applyRotationRequestSettings(
    {
      ...summary,
      games: nextGames,
    },
    request,
  );
}

export async function hydrateRotationLaunchSummary(request: LaunchRotationRequest): Promise<LaunchRotationSummary> {
  const baseSummary = request.resumeSummary
    ? applyRotationRequestSettings(request.resumeSummary, request)
    : applyRotationRequestSettings(
        loadRotationLaunchSummaryIfPresent(request.environmentId, request.rotationName.trim()) ||
          buildInitialRotationLaunchSummary(request),
        request,
      );

  return assignRotationGameNumbers(request, baseSummary);
}

export function persistRotationLaunchSummary(summary: LaunchRotationSummary): LaunchRotationSummary {
  return {
    ...summary,
    outputPath: writeRotationLaunchSummary(summary),
  };
}
