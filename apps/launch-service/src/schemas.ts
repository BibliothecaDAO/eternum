import { defaultPresetForEnvironment } from "../../../config/deployer/clean/constants";
import { nativePresetForId } from "../../../config/source/native";
import { Schema } from "effect";

const NonEmptyString = Schema.NonEmptyString;
const OptionalNumberRecord = Schema.optional(Schema.Record(Schema.String, Schema.Number));

const SharedOptions = {
  environment: Schema.Literals(["madara.blitz", "madara.eternum"]),
  // Registrar presets: 1 = Eternum, 2 = Regular Fast, 3 = Duel.
  version: Schema.optional(Schema.Literals(["1", "2", "3"])),
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
  environment: "madara.blitz" | "madara.eternum";
  version?: "1" | "2" | "3";
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
  const version = request.version ?? (defaultPresetForEnvironment(request.environment) as "1" | "2");
  if (
    nativePresetForId(Number(version)).gameType !== (request.environment === "madara.eternum" ? "eternum" : "blitz")
  ) {
    throw new Error("Preset does not match the requested game format");
  }
  const shared = { ...request, version };
  if (kind === "game" && "gameName" in shared) {
    return { ...shared, gameStartTime: shared.gameStartTime ?? new Date(now + 15 * 60_000).toISOString() };
  }
  return shared;
}
