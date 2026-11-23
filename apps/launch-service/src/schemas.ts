import { assertFrontierDates, assertFrontierSeason, CalendarConflict, type FrontierSeasonPhase } from "./calendar";
import { FRONTIER_REHEARSAL_PRESET_ID } from "../../../config/source/common/native-preset-modes";
import { gameClockScale } from "../../../config/source/common/season-clock";
import { nativePresetForId, nativePresetIdFor } from "../../../config/source/native";
import { isSeasonGame, seasonGameName, testnetGameName } from "../../../packages/types/src/constants/seasons";

export const isCalendarFrontier = (environment: string, name: string) =>
  environment === "madara.frontier" && isSeasonGame(name);

const isPublicGameName = (name: string) => !name.startsWith("check-");
interface SharedLaunchOptions {
  environment: "madara.blitz" | "madara.frontier";
  speed?: number;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: Record<string, number>;
  biomeClimateOverrides?: Record<string, number>;
  blitzRegistrationOverrides?: Record<string, number>;
}

export interface CreateGameRequest extends SharedLaunchOptions {
  gameName: string;
  gameStartTime?: string;
}

export const frontierSeasonRequest = (season: FrontierSeasonPhase): CreateGameRequest => {
  const start = Date.parse(season.startsAt);
  const end = Date.parse(season.endsAt);
  if (!Number.isSafeInteger(start) || start % 1000 !== 0 || !Number.isSafeInteger(end) || end % 1000 !== 0) {
    throw new Error("A Frontier season starts and ends on a whole second");
  }
  assertFrontierSeason(start, end);
  return {
    environment: "madara.frontier",
    gameName: seasonGameName(start / 1000),
    gameStartTime: new Date(start).toISOString(),
    durationSeconds: (end - start) / 1000,
  };
};

export class TestnetRefused extends Error {}

export type TestnetInput = { startsAt: number; endsAt: number; speed: number };

export const testnetPresetId = (speed: number): number => {
  const rehearsal = nativePresetForId(FRONTIER_REHEARSAL_PRESET_ID);
  if (speed === 1) return nativePresetIdFor("frontier");
  if (speed === gameClockScale(rehearsal)) return rehearsal.id;
  throw new TestnetRefused(`testnet_speed_${speed}_unknown`);
};

export const testnetRequest = ({ startsAt, endsAt, speed }: TestnetInput, deployment: string): CreateGameRequest => {
  if (speed !== 1 && deployment !== "staging") throw new TestnetRefused("testnet_speed_staging_only");
  const preset = nativePresetForId(testnetPresetId(speed));
  if (startsAt % 1_000 !== 0 || endsAt % 1_000 !== 0)
    throw new CalendarConflict("A testnet game starts and ends on a whole second");
  assertFrontierDates(preset, startsAt, endsAt);
  return {
    environment: "madara.frontier",
    gameName: testnetGameName(startsAt / 1_000),
    gameStartTime: new Date(startsAt).toISOString(),
    durationSeconds: (endsAt - startsAt) / 1_000,
    devModeOn: speed !== 1,
    ...(speed === 1 ? {} : { speed }),
  };
};

export function applyDurableLaunchDefaults(request: CreateGameRequest, now = Date.now()): CreateGameRequest {
  if (!isPublicGameName(request.gameName)) throw new Error("check- names are reserved for deployment");
  if (isCalendarFrontier(request.environment, request.gameName)) assertCalendarFrontierRequest(request);
  return {
    ...request,
    gameStartTime: request.gameStartTime ?? new Date(now + 15 * 60_000).toISOString(),
  };
}

const assertCalendarFrontierRequest = (request: CreateGameRequest) => {
  if (request.gameStartTime === undefined || request.durationSeconds === undefined)
    throw new CalendarConflict("A calendar Frontier launch needs an explicit start and duration");
  const start = Date.parse(request.gameStartTime);
  assertFrontierSeason(start, start + request.durationSeconds * 1000);
  if (request.gameName !== seasonGameName(start / 1000))
    throw new CalendarConflict("A calendar Frontier name must match its start");
};
