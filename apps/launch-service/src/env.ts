import { Schema } from "effect";
import { normalizeAddress } from "./address";

/**
 * The launch Worker's environment, decoded loudly so a misconfigured deployment fails on its first request or tick.
 * The shard it launches on and its launchers are set per environment at deploy; `DEPLOYER_PRIVATE_KEY` and
 * `OPERATOR_TOKEN` are secrets and are never committed.
 */
const LaunchVars = Schema.Struct({
  ENVIRONMENT: Schema.Literals(["staging", "production"]),
  /** The app's origin; the launch routes are served under its /api, beside identity. */
  BASE_URL: Schema.NonEmptyString,
  /** Comma-separated Starknet addresses allowed to launch games; a wildcard is refused. */
  LAUNCHER_ALLOWLIST: Schema.NonEmptyString,
  /** The shard launches write to: its Herald, whose /manifest names the chain, node, admission and contracts. */
  SHARD_URL: Schema.NonEmptyString,
  DEPLOYER_ACCOUNT_ADDRESS: Schema.NonEmptyString,
  DEPLOYER_PRIVATE_KEY: Schema.NonEmptyString,
  /** The environment's one operator token, which operator automation presents as a launcher. */
  OPERATOR_TOKEN: Schema.NonEmptyString,
});

type LaunchVars = Schema.Schema.Type<typeof LaunchVars>;

export interface LaunchEnv extends Omit<LaunchVars, "LAUNCHER_ALLOWLIST"> {
  launchers: ReadonlySet<string>;
  DB: D1Database;
  /** The identity Worker, which owns sessions; reached by service binding only. */
  IDENTITY: Fetcher;
  /** The one registrar that executes launches, one at a time. */
  REGISTRAR: DurableObjectNamespace<import("./registrar").Registrar>;
  /** The deployed version, so a deploy can tell its own answers from its predecessor's. */
  VERSION: WorkerVersionMetadata;
}

const decodeLaunchVars = Schema.decodeUnknownSync(LaunchVars, { onExcessProperty: "ignore" });

export const decodeLaunchEnv = (raw: Record<string, unknown>): LaunchEnv => {
  const { LAUNCHER_ALLOWLIST, ...vars } = decodeLaunchVars(raw);
  return {
    ...vars,
    launchers: launchersOf(LAUNCHER_ALLOWLIST),
    DB: raw.DB as D1Database,
    IDENTITY: raw.IDENTITY as Fetcher,
    REGISTRAR: raw.REGISTRAR as LaunchEnv["REGISTRAR"],
    VERSION: raw.VERSION as WorkerVersionMetadata,
  };
};

const launchersOf = (allowlist: string): ReadonlySet<string> => {
  const entries = allowlist
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (entries.includes("*")) throw new Error("LAUNCHER_ALLOWLIST must name launcher addresses, not *");
  return new Set(entries.map(normalizeAddress));
};
