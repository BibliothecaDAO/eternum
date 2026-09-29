import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import { defaultPresetForEnvironment } from "../../../config/deployer/clean/constants";
import { nativePresetIdFor, nativePresets } from "../../../config/source/native";
import { Schema } from "effect";

const NonEmptyString = Schema.NonEmptyString;
const OptionalNumberRecord = Schema.optional(Schema.Record(Schema.String, Schema.Number));

const SharedOptions = {
  environment: Schema.Literals(["madara.blitz", "madara.eternum", "madara.frontier"]),
  version: Schema.optional(Schema.String),
  devModeOn: Schema.optional(Schema.Boolean),
  singleRealmMode: Schema.optional(Schema.Boolean),
  durationSeconds: Schema.optional(Schema.Number),
  mapConfigOverrides: OptionalNumberRecord,
  biomeClimateOverrides: OptionalNumberRecord,
  blitzRegistrationOverrides: OptionalNumberRecord,
};

export const CreateGameRequestSchema = Schema.Struct({
  ...SharedOptions,
  gameName: NonEmptyString,
  rosterAccounts: Schema.optional(Schema.Array(Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-fA-F]+$/))))),
  gameStartTime: Schema.optional(NonEmptyString),
}).check(
  Schema.makeFilter((request) =>
    request.version === undefined || isRegisteredPresetForEnvironment(request.environment, request.version)
      ? undefined
      : { path: ["version"], issue: "Preset is not registered for the requested game format" },
  ),
);

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
  rosterAccounts?: readonly string[];
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
export const frontierSeasonRequest = (season: { startsAt: string; endsAt: string }): CreateGameRequest => {
  const start = Date.parse(season.startsAt);
  const end = Date.parse(season.endsAt);
  if (!Number.isSafeInteger(start) || start % 1000 !== 0 || !Number.isSafeInteger(end) || end % 1000 !== 0) {
    throw new Error("A Frontier season starts and ends on a whole second");
  }
  return {
    environment: "madara.frontier",
    version: String(nativePresetIdFor("frontier")) as "5",
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
