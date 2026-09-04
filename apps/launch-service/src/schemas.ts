import { Schema } from "effect";
import type { LaunchRotationWeekday } from "../../../config/deployer/clean/types";

const NonEmptyString = Schema.NonEmptyString;
const OptionalNumberRecord = Schema.optional(Schema.Record(Schema.String, Schema.Number));

const SharedOptions = {
  environment: Schema.Literal("madara.blitz"),
  // The offered registrar presets: 8 = Regular Fast, 9 = Duel (6/7 retired —
  // they baked 24-tick spawn immunity). The client's preset catalog is the
  // authority on which one a launch uses.
  version: Schema.optional(Schema.Literals(["8", "9"])),
  devModeOn: Schema.optional(Schema.Boolean),
  twoPlayerMode: Schema.optional(Schema.Boolean),
  singleRealmMode: Schema.optional(Schema.Boolean),
  durationSeconds: Schema.optional(Schema.Number),
  mapConfigOverrides: OptionalNumberRecord,
  biomeClimateOverrides: OptionalNumberRecord,
  blitzRegistrationOverrides: OptionalNumberRecord,
};

export const CreateGameRequestSchema = Schema.Struct({
  ...SharedOptions,
  gameName: NonEmptyString,
  gameStartTime: Schema.optional(NonEmptyString),
  workflowRef: Schema.optional(NonEmptyString),
});

const SeriesGameSchema = Schema.Struct({
  gameName: NonEmptyString,
  startTime: NonEmptyString,
  seriesGameNumber: Schema.optional(Schema.Number),
  biomeClimateOverrides: OptionalNumberRecord,
});

export const CreateSeriesRequestSchema = Schema.Struct({
  ...SharedOptions,
  seriesName: NonEmptyString,
  workflowRef: Schema.optional(NonEmptyString),
  games: Schema.Array(SeriesGameSchema),
  autoRetryIntervalMinutes: Schema.optional(Schema.Number),
});

const WeeklyCadenceSchema = Schema.Struct({
  gameNamePrefix: Schema.optional(NonEmptyString),
  weekday: Schema.Literals(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  utcTime: NonEmptyString,
  biomeClimateOverrides: OptionalNumberRecord,
  blitzRegistrationOverrides: OptionalNumberRecord,
});

export const CreateRotationRequestSchema = Schema.Struct({
  ...SharedOptions,
  rotationName: NonEmptyString,
  workflowRef: Schema.optional(NonEmptyString),
  firstGameStartTime: NonEmptyString,
  gameIntervalMinutes: Schema.Number,
  maxGames: Schema.Number,
  advanceWindowGames: Schema.optional(Schema.Number),
  evaluationIntervalMinutes: Schema.Number,
  weeklyCadence: Schema.optional(Schema.Array(WeeklyCadenceSchema)),
  biomeClimateOverridesByGameNumber: Schema.optional(
    Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Number)),
  ),
  autoRetryIntervalMinutes: Schema.optional(Schema.Number),
});

interface SharedLaunchOptions {
  environment: "madara.blitz";
  version?: "8" | "9";
  devModeOn?: boolean;
  twoPlayerMode?: boolean;
  singleRealmMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: Record<string, number>;
  biomeClimateOverrides?: Record<string, number>;
  blitzRegistrationOverrides?: Record<string, number>;
}

export interface CreateGameRequest extends SharedLaunchOptions {
  gameName: string;
  gameStartTime?: string;
  workflowRef?: string;
}

export interface CreateSeriesRequest extends SharedLaunchOptions {
  seriesName: string;
  workflowRef?: string;
  games: ReadonlyArray<{
    gameName: string;
    startTime: string;
    seriesGameNumber?: number;
    biomeClimateOverrides?: Record<string, number>;
  }>;
  autoRetryIntervalMinutes?: number;
}

export interface CreateRotationRequest extends SharedLaunchOptions {
  rotationName: string;
  workflowRef?: string;
  firstGameStartTime: string;
  gameIntervalMinutes: number;
  maxGames: number;
  advanceWindowGames?: number;
  evaluationIntervalMinutes: number;
  weeklyCadence?: ReadonlyArray<{
    gameNamePrefix?: string;
    weekday: LaunchRotationWeekday;
    utcTime: string;
    biomeClimateOverrides?: Record<string, number>;
    blitzRegistrationOverrides?: Record<string, number>;
  }>;
  biomeClimateOverridesByGameNumber?: Record<number, Record<string, number>>;
  autoRetryIntervalMinutes?: number;
}
export type LaunchJobRequest = CreateGameRequest | CreateSeriesRequest | CreateRotationRequest;
export type LaunchKind = "game" | "series" | "rotation";

export const applyDurableLaunchDefaults = (
  kind: LaunchKind,
  request: LaunchJobRequest,
  now = Date.now(),
): LaunchJobRequest => {
  // Request values are honored, never overwritten — the client's preset is the
  // authority (devModeOn: Sandbox on, real games off; version: 6 = Regular Fast,
  // 7 = Duel). Defaults here only fill absent fields, once, before persistence.
  const shared = { ...request, version: request.version ?? ("8" as const) };
  if (kind === "game" && "gameName" in shared) {
    return { ...shared, gameStartTime: shared.gameStartTime ?? new Date(now + 15 * 60_000).toISOString() };
  }
  return shared;
};
