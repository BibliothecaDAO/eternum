import { assertFrontierSeason, CalendarConflict, type FrontierSeasonPhase } from "./calendar";
import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import { defaultPresetForEnvironment } from "../../../config/deployer/clean/constants";
import { nativePresets } from "../../../config/source/native";

export const isCalendarFrontier = (environment: string, name: string) =>
  environment === "madara.frontier" && /^frontier-\d+$/.test(name);

export const isPublicGameName = (name: string) => !name.startsWith("check-");
interface SharedLaunchOptions {
  environment: "madara.blitz" | "madara.eternum" | "madara.frontier";
  version?: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: Record<string, number>;
  biomeClimateOverrides?: Record<string, number>;
  blitzRegistrationOverrides?: Record<string, number>;
}

export interface CreateGameRequest extends SharedLaunchOptions {
  slotId?: number;
  groupIndex?: number;
  /** A test Blitz's player accounts, named by the operator; a paid Blitz reads its players from its slot instead. */
  players?: string[];
  gameName: string;
  gameStartTime?: string;
}
export interface FinalizeGameRequest {
  environment: "madara.blitz";
  gameName: string;
  gameId: number;
}

export type LaunchJobRequest = CreateGameRequest | FinalizeGameRequest;
export type LaunchKind = "game" | "result";

/**
 * A season is one open-entry game named by its start, so scheduling the same start twice names the same game. It runs
 * to the calendar's planned end; the preset's own duration is only a fallback for games created outside the calendar.
 */
export const frontierSeasonRequest = (season: FrontierSeasonPhase): CreateGameRequest => {
  const start = Date.parse(season.startsAt);
  const end = Date.parse(season.endsAt);
  if (!Number.isSafeInteger(start) || start % 1000 !== 0 || !Number.isSafeInteger(end) || end % 1000 !== 0) {
    throw new Error("A Frontier season starts and ends on a whole second");
  }
  assertFrontierSeason(start, end, season.presetId);
  return {
    environment: "madara.frontier",
    version: String(season.presetId),
    gameName: `frontier-${start / 1000}`,
    gameStartTime: new Date(start).toISOString(),
    durationSeconds: (end - start) / 1000,
  };
};

const isRegisteredPresetForEnvironment = (environment: CreateGameRequest["environment"], version: string): boolean => {
  if (!/^(0|[1-9]\d*)$/.test(version)) return false;
  const preset = nativePresets[Number(version)];
  return preset !== undefined && preset.gameType === resolveDeploymentEnvironment(environment).gameType;
};

export function applyDurableLaunchDefaults(kind: "game", request: CreateGameRequest, now?: number): CreateGameRequest;
export function applyDurableLaunchDefaults(
  kind: "result",
  request: FinalizeGameRequest,
  now?: number,
): FinalizeGameRequest;
export function applyDurableLaunchDefaults(kind: LaunchKind, request: LaunchJobRequest, now?: number): LaunchJobRequest;
export function applyDurableLaunchDefaults(
  kind: LaunchKind,
  request: LaunchJobRequest,
  now = Date.now(),
): LaunchJobRequest {
  if (kind === "result") return request;
  if (!("gameName" in request) || "gameId" in request) throw new Error("Invalid game request");
  if (!isPublicGameName(request.gameName)) throw new Error("check- names are reserved for deployment");
  if (isCalendarFrontier(request.environment, request.gameName)) assertCalendarFrontierRequest(request);
  const version =
    request.version ?? (defaultPresetForEnvironment(request.environment) as NonNullable<CreateGameRequest["version"]>);
  if (!isRegisteredPresetForEnvironment(request.environment, version)) {
    throw new Error("Preset does not match the requested game format");
  }
  return {
    ...request,
    version,
    gameStartTime: request.gameStartTime ?? new Date(now + 15 * 60_000).toISOString(),
  };
}

const assertCalendarFrontierRequest = (request: CreateGameRequest) => {
  if (request.version === undefined || request.gameStartTime === undefined || request.durationSeconds === undefined)
    throw new CalendarConflict("A calendar Frontier launch needs an explicit preset, start and duration");
  const start = Date.parse(request.gameStartTime);
  assertFrontierSeason(start, start + request.durationSeconds * 1000, Number(request.version));
  if (request.gameName !== `frontier-${start / 1000}`)
    throw new CalendarConflict("A calendar Frontier name must match its start");
};
