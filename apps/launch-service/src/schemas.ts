import { assertFrontierSeason, CalendarConflict, type FrontierSeasonPhase } from "./calendar";

export const isCalendarFrontier = (environment: string, name: string) =>
  environment === "madara.frontier" && /^frontier-\d+$/.test(name);

const isPublicGameName = (name: string) => !name.startsWith("check-");
interface SharedLaunchOptions {
  environment: "madara.blitz" | "madara.frontier";
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
    gameName: `frontier-${start / 1000}`,
    gameStartTime: new Date(start).toISOString(),
    durationSeconds: (end - start) / 1000,
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
  if (request.gameName !== `frontier-${start / 1000}`)
    throw new CalendarConflict("A calendar Frontier name must match its start");
};
