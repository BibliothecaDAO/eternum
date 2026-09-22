import { Schema } from "effect";
import type { Guardian } from "@realms-world/guardian";

/**
 * The identity Worker's environment. Plain values are decoded loudly, so a misconfigured deployment fails on its first
 * request instead of answering with defaults. Secrets (`BETTER_AUTH_SECRET`, `IDENTITY_RPC_URL`,
 * `DIRECTORY_ADMIN_TOKEN`) are set per environment and never committed.
 */
const IdentityVars = Schema.Struct({
  ENVIRONMENT: Schema.Literals(["staging", "production"]),
  /** The app's origin; identity is served under its /api. */
  BASE_URL: Schema.NonEmptyString,
  /** The RealmsAccount class every shard deploys player accounts from. */
  ACCOUNT_CLASS_HASH: Schema.NonEmptyString,
  BETTER_AUTH_SECRET: Schema.NonEmptyString,
  /** A Starknet mainnet RPC, for Sign in with Starknet signature checks. */
  IDENTITY_RPC_URL: Schema.NonEmptyString,
  /** The operator's token for listing shards and changing their status. */
  DIRECTORY_ADMIN_TOKEN: Schema.NonEmptyString,
});

export interface IdentityEnv extends Schema.Schema.Type<typeof IdentityVars> {
  DB: D1Database;
  /** The guardian Worker, reached by service binding only. */
  GUARDIAN: Guardian;
  PUBLIC_RATE_LIMIT: RateLimit;
  /** The deployed version, so a deploy can tell its own answers from its predecessor's. */
  VERSION: WorkerVersionMetadata;
}

const decodeIdentityVars = Schema.decodeUnknownSync(IdentityVars, { onExcessProperty: "ignore" });

export const decodeIdentityEnv = (raw: Record<string, unknown>): IdentityEnv => ({
  ...decodeIdentityVars(raw),
  DB: raw.DB as D1Database,
  GUARDIAN: raw.GUARDIAN as Guardian,
  PUBLIC_RATE_LIMIT: raw.PUBLIC_RATE_LIMIT as RateLimit,
  VERSION: raw.VERSION as WorkerVersionMetadata,
});
