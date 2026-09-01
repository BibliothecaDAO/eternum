import path from "node:path";
import { Effect, Schema } from "effect";
import { normalizeAddress } from "./address";
import { BoundaryDecodeError } from "./errors";

const NonEmptyString = Schema.NonEmptyString;
const EnvironmentSchema = Schema.Struct({
  DATABASE_URL: NonEmptyString,
  IDENTITY_URL: NonEmptyString,
  CORS_ORIGIN: NonEmptyString,
  LAUNCHER_ALLOWLIST: NonEmptyString,
  RPC_URL: NonEmptyString,
  HERALD_URL: NonEmptyString,
  GAME_MANIFEST_PATH: NonEmptyString,
  DOJO_ACCOUNT_ADDRESS: NonEmptyString,
  DOJO_PRIVATE_KEY: NonEmptyString,
  PORT: Schema.optional(Schema.String),
  LAUNCH_JOB_LEASE_MS: Schema.optional(Schema.String),
  LAUNCH_JOB_POLL_MS: Schema.optional(Schema.String),
  LAUNCH_ROTATION_CONFIGS: Schema.optional(Schema.String),
});

export interface LaunchServiceConfig {
  databaseUrl: string;
  identityUrl: string;
  allowedOrigins: ReadonlySet<string>;
  allowAnyLauncher: boolean;
  launcherAllowlist: ReadonlySet<string>;
  rpcUrl: string;
  heraldUrl: string;
  manifestPath: string;
  accountAddress: string;
  privateKey: string;
  port: number;
  leaseMs: number;
  pollMs: number;
  rotationConfigs: readonly string[];
}

const positiveInteger = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
};

export const readLaunchServiceConfig = (
  environment: Record<string, string | undefined> = process.env,
): Effect.Effect<LaunchServiceConfig, BoundaryDecodeError> =>
  Schema.decodeUnknownEffect(EnvironmentSchema)(environment).pipe(
    Effect.flatMap((raw) =>
      Effect.try(() => {
        const launcherEntries = raw.LAUNCHER_ALLOWLIST.split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        return {
          databaseUrl: raw.DATABASE_URL,
          identityUrl: raw.IDENTITY_URL,
          allowedOrigins: new Set(
            raw.CORS_ORIGIN.split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
          // "*" opens launching to any verified session (still origin- and session-gated).
          allowAnyLauncher: launcherEntries.includes("*"),
          launcherAllowlist: new Set(launcherEntries.filter((entry) => entry !== "*").map(normalizeAddress)),
          rpcUrl: raw.RPC_URL,
          heraldUrl: raw.HERALD_URL,
          manifestPath: path.resolve(raw.GAME_MANIFEST_PATH),
          accountAddress: normalizeAddress(raw.DOJO_ACCOUNT_ADDRESS),
          privateKey: raw.DOJO_PRIVATE_KEY,
          port: positiveInteger(raw.PORT, 3006, "PORT"),
          leaseMs: positiveInteger(raw.LAUNCH_JOB_LEASE_MS, 120_000, "LAUNCH_JOB_LEASE_MS"),
          pollMs: positiveInteger(raw.LAUNCH_JOB_POLL_MS, 1_000, "LAUNCH_JOB_POLL_MS"),
          rotationConfigs: (
            raw.LAUNCH_ROTATION_CONFIGS ?? "config/deployer/clean/launch-configs/madara-blitz-daily.yaml"
          )
            .split(",")
            .map((value) => path.resolve(value.trim()))
            .filter(Boolean),
        };
      }),
    ),
    Effect.mapError((cause) => new BoundaryDecodeError({ boundary: "launch-service-environment", cause })),
  );
