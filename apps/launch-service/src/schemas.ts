import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import { defaultPresetForEnvironment } from "../../../config/deployer/clean/constants";
import { nativePresetForId, nativePresetIdFor } from "../../../config/source/native";
import { Schema } from "effect";

const NonEmptyString = Schema.NonEmptyString;
const OptionalNumberRecord = Schema.optional(Schema.Record(Schema.String, Schema.Number));

const SharedOptions = {
  // Frontier is never created through the API: the season schedule owns it.
  environment: Schema.Literals(["madara.blitz", "madara.eternum"]),
  // One preset id per game mode.
  version: Schema.optional(Schema.Literals(["1", "2", "3", "4"])),
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
  rosterOwners: Schema.optional(Schema.Array(Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-fA-F]+$/))))),
  gameStartTime: Schema.optional(NonEmptyString),
  workflowRef: Schema.optional(NonEmptyString),
});

interface SharedLaunchOptions {
  environment: "madara.blitz" | "madara.eternum" | "madara.frontier";
  version?: "1" | "2" | "3" | "4";
  devModeOn?: boolean;
  twoPlayerMode?: boolean;
  singleRealmMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: Record<string, number>;
  biomeClimateOverrides?: Record<string, number>;
  blitzRegistrationOverrides?: Record<string, number>;
}

export interface CreateGameRequest extends SharedLaunchOptions {
  rosterOwners?: readonly string[];
  gameName: string;
  gameStartTime?: string;
  workflowRef?: string;
}
export interface FinalizeGameRequest {
  environment: "madara.blitz";
  gameName: string;
  gameId: number;
}

export type LaunchJobRequest = CreateGameRequest | FinalizeGameRequest;
export type LaunchKind = "game" | "result";

/** A season is one open-entry game named by its start, so scheduling the same start twice names the same game. */
export const frontierSeasonRequest = (seasonStart: string): CreateGameRequest => {
  const start = Date.parse(seasonStart);
  if (!Number.isSafeInteger(start) || start % 1000 !== 0) {
    throw new Error("FRONTIER_SEASON_START must be an ISO timestamp on a whole second");
  }
  return {
    environment: "madara.frontier",
    version: String(nativePresetIdFor("frontier")) as "1",
    gameName: `frontier-${start / 1000}`,
    gameStartTime: new Date(start).toISOString(),
  };
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
  const preset = nativePresetForId(Number(version));
  if (preset.environmentGameType !== resolveDeploymentEnvironment(request.environment).gameType) {
    throw new Error("Preset does not match the requested game format");
  }
  if ((version === "4") !== Boolean(request.twoPlayerMode))
    throw new Error("Duel uses preset 4; other modes cannot use Duel settlement");
  return {
    ...request,
    version,
    gameStartTime: request.gameStartTime ?? new Date(now + 15 * 60_000).toISOString(),
  };
}
