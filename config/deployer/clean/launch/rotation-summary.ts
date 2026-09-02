import { resolveDeploymentEnvironment } from "../environment";
import type {
  LaunchRotationRequest,
  LaunchRotationSummary,
  LaunchRotationWeeklyCadenceEntry,
  RotationLaunchStepId,
  SeriesLaunchGameStepState,
  SeriesLaunchGameSummary,
} from "../types";
import { resolveSeriesLaunchStepIds } from "./series-plan";
import { fileLaunchRunStore, type LaunchRunStore } from "./run-store";
import { parseStartTime, toIsoUtc } from "./time";
import { requireRpcUrl } from "../shared/rpc";

export const DEFAULT_ROTATION_AUTO_RETRY_INTERVAL_MINUTES = 15;
export const DEFAULT_ROTATION_ADVANCE_WINDOW_GAMES = 5;
const WEEKLY_CADENCE_PERIOD_SECONDS = 7 * 24 * 60 * 60;
const WEEKDAY_OFFSET_DAYS: Record<LaunchRotationWeeklyCadenceEntry["weekday"], number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

interface PlannedRotationGame {
  startTime: number;
  gameNamePrefix?: string;
  biomeClimateOverrides?: LaunchRotationWeeklyCadenceEntry["biomeClimateOverrides"];
  blitzRegistrationOverrides?: LaunchRotationWeeklyCadenceEntry["blitzRegistrationOverrides"];
}

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

  if (hasWeeklyCadence(request)) {
    validateWeeklyCadence(request.weeklyCadence);
  } else {
    validateRotationPositiveInteger(request.gameIntervalMinutes, "game interval minutes");
  }

  validateRotationPositiveInteger(request.maxGames, "max games");
  validateRotationPositiveInteger(request.evaluationIntervalMinutes, "evaluation interval minutes");
  validateRotationPositiveInteger(resolveRotationAdvanceWindowGames(request), "advance window games");

  if (resolveRotationAdvanceWindowGames(request) > request.maxGames) {
    throw new Error("Advance window games cannot be greater than max games");
  }

  parseStartTime(request.firstGameStartTime);
}

export async function resolveRotationRequestWithPersistedSchedule<TRequest extends LaunchRotationRequest>(
  request: TRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<TRequest> {
  if (hasRequestSchedule(request)) {
    return request;
  }

  const summary = await resolvePersistedRotationScheduleSummary(request, store);
  if (!summary) {
    return request;
  }

  return {
    ...request,
    gameIntervalMinutes: resolvePersistedRotationGameIntervalMinutes(request, summary),
    weeklyCadence: hasWeeklyCadence(request) ? request.weeklyCadence : summary.weeklyCadence,
  };
}

function hasRequestSchedule(request: LaunchRotationRequest): boolean {
  return hasWeeklyCadence(request) || isRotationPositiveInteger(request.gameIntervalMinutes);
}

async function resolvePersistedRotationScheduleSummary(
  request: LaunchRotationRequest,
  store: LaunchRunStore,
): Promise<LaunchRotationSummary | null> {
  return request.resumeSummary ?? store.loadRotation(request.environmentId, request.rotationName.trim());
}

function resolvePersistedRotationGameIntervalMinutes(
  request: LaunchRotationRequest,
  summary: LaunchRotationSummary,
): number {
  if (hasWeeklyCadence(summary)) {
    return request.gameIntervalMinutes;
  }

  return isRotationPositiveInteger(summary.gameIntervalMinutes)
    ? summary.gameIntervalMinutes
    : request.gameIntervalMinutes;
}

function validateRotationPositiveInteger(value: number, label: string): void {
  if (!isRotationPositiveInteger(value)) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function isRotationPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function hasWeeklyCadence(request: Pick<LaunchRotationRequest, "weeklyCadence">): boolean {
  return Boolean(request.weeklyCadence?.length);
}

function validateWeeklyCadence(weeklyCadence: LaunchRotationWeeklyCadenceEntry[] | undefined): void {
  if (!weeklyCadence?.length) {
    throw new Error("weekly cadence must include at least one entry");
  }

  const scheduledOffsets = new Set<number>();
  for (const entry of weeklyCadence) {
    validateWeeklyCadenceEntry(entry);
    const scheduledOffset = resolveWeeklyCadenceOffsetSeconds(entry);
    if (scheduledOffsets.has(scheduledOffset)) {
      throw new Error(`weekly cadence contains more than one game at ${entry.weekday} ${entry.utcTime} UTC`);
    }
    scheduledOffsets.add(scheduledOffset);
  }
}

function validateWeeklyCadenceEntry(entry: LaunchRotationWeeklyCadenceEntry): void {
  if (entry.gameNamePrefix !== undefined && !entry.gameNamePrefix.trim()) {
    throw new Error("weekly cadence gameNamePrefix must be a non-empty string when provided");
  }

  if (!(entry.weekday in WEEKDAY_OFFSET_DAYS)) {
    throw new Error(`weekly cadence weekday "${entry.weekday}" is not supported`);
  }

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(entry.utcTime)) {
    throw new Error(`weekly cadence utcTime "${entry.utcTime}" must be HH:MM in UTC`);
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
  gameName?: string,
  biomeClimateOverrides?: LaunchRotationWeeklyCadenceEntry["biomeClimateOverrides"],
  blitzRegistrationOverrides?: LaunchRotationWeeklyCadenceEntry["blitzRegistrationOverrides"],
): SeriesLaunchGameSummary {
  return {
    gameName: gameName ?? buildRotationGameName(rotationName, seriesGameNumber),
    startTime,
    startTimeIso: toIsoUtc(startTime),
    durationSeconds: defaultDurationSeconds,
    ...(biomeClimateOverrides ? { biomeClimateOverrides } : {}),
    ...(blitzRegistrationOverrides ? { blitzRegistrationOverrides } : {}),
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
  const slug = toRotationSlug(rotationName);

  return `${slug || "rotation"}-${String(seriesGameNumber).padStart(4, "0")}`;
}

function buildWeeklyCadenceGameName(gameNamePrefix: string, startTime: number): string {
  const date = new Date(startTime * 1000);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${toRotationSlug(gameNamePrefix) || "rotation"}-${day}-${month}-${year}-${hour}${minute}`;
}

function toRotationSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    weeklyCadence: request.weeklyCadence,
    rpcUrl: requireRpcUrl(request.rpcUrl, "RPC_URL"),
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
    rpcUrl: requireRpcUrl(request.rpcUrl || summary.rpcUrl, "RPC_URL"),
    autoRetryEnabled: request.autoRetryEnabled ?? summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
    dryRun: request.dryRun === true,
    configMode: request.executionMode || summary.configMode,
    weeklyCadence: request.weeklyCadence ?? summary.weeklyCadence,
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
  _request: LaunchRotationRequest,
  summary: LaunchRotationSummary,
): Promise<LaunchRotationSummary> {
  validatePersistedRotationGameNumbers(summary);

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
        gameName: buildRotationGameName(summary.rotationName, assignedGameNumber),
      };
    }),
  };
}

function resolveNextFixedRotationStartTime(summary: LaunchRotationSummary, afterSeconds: number): number {
  const lastPlannedStartTime = summary.games.at(-1)?.startTime;
  if (lastPlannedStartTime && afterSeconds <= lastPlannedStartTime) {
    return lastPlannedStartTime + summary.gameIntervalMinutes * 60;
  }

  if (summary.firstGameStartTime > afterSeconds) {
    return summary.firstGameStartTime;
  }

  const intervalSeconds = summary.gameIntervalMinutes * 60;
  const elapsedSeconds = afterSeconds - summary.firstGameStartTime;
  const skippedIntervals = Math.floor(elapsedSeconds / intervalSeconds) + 1;
  return summary.firstGameStartTime + skippedIntervals * intervalSeconds;
}

function resolveNextWeeklyCadenceGame(summary: LaunchRotationSummary, afterSeconds: number): PlannedRotationGame {
  const cadence = resolveSortedWeeklyCadence(summary);
  const weekStartSeconds = resolveCadenceWeekStartSeconds(summary.firstGameStartTime);
  const searchStartSeconds = Math.max(afterSeconds + 1, summary.firstGameStartTime);
  const firstWeekIndex = Math.max(
    0,
    Math.floor((searchStartSeconds - weekStartSeconds) / WEEKLY_CADENCE_PERIOD_SECONDS),
  );

  for (let weekIndex = firstWeekIndex; weekIndex <= firstWeekIndex + 1; weekIndex += 1) {
    for (const entry of cadence) {
      const startTime = weekStartSeconds + weekIndex * WEEKLY_CADENCE_PERIOD_SECONDS + entry.offsetSeconds;
      if (startTime >= summary.firstGameStartTime && startTime > afterSeconds) {
        return {
          startTime,
          gameNamePrefix: entry.gameNamePrefix,
          biomeClimateOverrides: entry.biomeClimateOverrides,
          blitzRegistrationOverrides: entry.blitzRegistrationOverrides,
        };
      }
    }
  }

  throw new Error(`Unable to resolve the next weekly rotation game for ${summary.rotationName}`);
}

function resolveNextRotationGame(summary: LaunchRotationSummary, afterSeconds: number): PlannedRotationGame {
  if (summary.weeklyCadence?.length) {
    return resolveNextWeeklyCadenceGame(summary, afterSeconds);
  }

  return {
    startTime: resolveNextFixedRotationStartTime(summary, afterSeconds),
  };
}

function resolveFixedRotationGameBiomeClimateOverride(
  request: LaunchRotationRequest,
  seriesGameNumber: number,
): LaunchRotationWeeklyCadenceEntry["biomeClimateOverrides"] {
  return request.biomeClimateOverridesByGameNumber?.[seriesGameNumber] ?? request.biomeClimateOverrides;
}

function resolveSortedWeeklyCadence(summary: LaunchRotationSummary) {
  if (!summary.weeklyCadence?.length) {
    throw new Error("weekly cadence must include at least one entry");
  }

  return summary.weeklyCadence
    .map((entry) => ({
      ...entry,
      offsetSeconds: resolveWeeklyCadenceOffsetSeconds(entry),
    }))
    .sort(
      (left, right) =>
        left.offsetSeconds - right.offsetSeconds ||
        (left.gameNamePrefix ?? "").localeCompare(right.gameNamePrefix ?? ""),
    );
}

function resolveWeeklyCadenceOffsetSeconds(entry: LaunchRotationWeeklyCadenceEntry): number {
  const [hour = "0", minute = "0"] = entry.utcTime.split(":");
  return (WEEKDAY_OFFSET_DAYS[entry.weekday] * 24 * 60 + Number(hour) * 60 + Number(minute)) * 60;
}

function resolveCadenceWeekStartSeconds(firstGameStartTime: number): number {
  const date = new Date(firstGameStartTime * 1000);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday, 0, 0, 0) / 1000,
  );
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
  let nextGame = resolveNextRotationGame(summary, nextGames.at(-1)?.startTime ?? nowSeconds);

  for (let index = 0; index < gamesToAdd; index += 1) {
    nextGameNumber += 1;
    nextGames.push(
      buildRotationGameSummary(
        summary.rotationName,
        nextGameNumber,
        nextGame.startTime,
        stepIds,
        request.durationSeconds,
        nextGame.gameNamePrefix ? buildWeeklyCadenceGameName(nextGame.gameNamePrefix, nextGame.startTime) : undefined,
        nextGame.biomeClimateOverrides ?? resolveFixedRotationGameBiomeClimateOverride(request, nextGameNumber),
        nextGame.blitzRegistrationOverrides,
      ),
    );
    nextGame = resolveNextRotationGame(summary, nextGame.startTime);
  }

  return applyRotationRequestSettings(
    {
      ...summary,
      games: nextGames,
    },
    request,
  );
}

export async function hydrateRotationLaunchSummary(
  request: LaunchRotationRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchRotationSummary> {
  const baseSummary = request.resumeSummary
    ? applyRotationRequestSettings(request.resumeSummary, request)
    : applyRotationRequestSettings(
        (await store.loadRotation(request.environmentId, request.rotationName.trim())) ||
          buildInitialRotationLaunchSummary(request),
        request,
      );

  return assignRotationGameNumbers(request, baseSummary);
}

export const persistRotationLaunchSummary = (
  summary: LaunchRotationSummary,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchRotationSummary> => store.saveRotation(summary);
