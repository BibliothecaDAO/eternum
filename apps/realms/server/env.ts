import { Schema } from "effect";
import { identityL2Configuration } from "./l2";
import type { Guardian } from "@realms-world/guardian";

/**
 * The identity Worker's environment. Plain values are decoded loudly, so a misconfigured deployment fails on its first
 * request instead of answering with defaults. Secrets (`BETTER_AUTH_SECRET`, `IDENTITY_RPC_URL`,
 * `OPERATOR_TOKEN`, the `WEB_PUSH_VAPID_*` keys, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `RESEND_API_KEY`) are set
 * per environment and never committed.
 */
const IdentityVars = Schema.Struct({
  ENVIRONMENT: Schema.Literals(["staging", "production"]),
  /** The app's origin; identity is served under its /api. */
  BASE_URL: Schema.NonEmptyString,
  /** The RealmsAccount class every shard deploys player accounts from. */
  ACCOUNT_CLASS_HASH: Schema.NonEmptyString,
  BETTER_AUTH_SECRET: Schema.NonEmptyString,
  /** The environment's one L2 chain, shared by proofs, Realm ownership and ratings. */
  L2_CHAIN_ID: Schema.Literals(["SN_MAIN", "SN_SEPOLIA"]),
  REALMS_ADDRESS: Schema.NonEmptyString,
  RATING_TOKEN_ADDRESS: Schema.NonEmptyString,
  RATING_HISTORY_URL: Schema.NonEmptyString,
  /** Only the configured chain's HTTPS Alchemy RPC is accepted. */
  IDENTITY_RPC_URL: Schema.NonEmptyString,
  /** The environment's one operator token for all automation: listing shards and changing their status here. */
  OPERATOR_TOKEN: Schema.NonEmptyString,
  /** The Discord application players sign in with; its redirect is {BASE_URL}/api/auth/callback/discord. */
  DISCORD_CLIENT_ID: Schema.NonEmptyString,
  DISCORD_CLIENT_SECRET: Schema.NonEmptyString,
  /** The email provider's key, for one-time sign-in codes. */
  RESEND_API_KEY: Schema.NonEmptyString,
  /** The environment's VAPID key pair (base64url) and contact, which sign every web push. */
  WEB_PUSH_VAPID_PUBLIC_KEY: Schema.NonEmptyString,
  WEB_PUSH_VAPID_PRIVATE_KEY: Schema.NonEmptyString,
  WEB_PUSH_VAPID_SUBJECT: Schema.NonEmptyString,
  /** How often each shard notifier reads its shard's new stories; its retries wait whole polls. */
  SHARD_NOTIFIER_POLL_MS: Schema.FiniteFromString.pipe(Schema.check(Schema.isGreaterThan(0))),
});

export interface IdentityEnv extends Schema.Schema.Type<typeof IdentityVars> {
  DB: D1Database;
  ACCOUNT_LINKS: {
    changed(realmsId: string): Promise<unknown>;
    status(realmsId: string): Promise<import("@realms-world/identity").LedgerLinkStatus>;
  };
  /** The guardian Worker, reached by service binding only. */
  GUARDIAN: Guardian;
  /** The launch Worker, reached by service binding only. */
  LAUNCH: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  RATING_READER: DurableObjectNamespace<import("./rating-reader").RatingReader>;
  PUBLIC_RATE_LIMIT: RateLimit;
  /** 100 viewers behind one NAT: four polls and two history reads each per minute. */
  DIRECTORY_RATE_LIMIT: RateLimit;
  /** Sign-in codes sent to one email address. */
  SIGN_IN_CODE_RATE_LIMIT: RateLimit;
  /** The deployed version, so a deploy can tell its own answers from its predecessor's. */
  VERSION: WorkerVersionMetadata;
  /** One notifier per listed shard, named by the shard's URL. */
  SHARD_NOTIFIER: DurableObjectNamespace<import("./shard-notifier").ShardNotifier>;
  /** One chat room per room id, and one direct-message inbox per Realms account. */
  CHAT_ROOM: DurableObjectNamespace<import("./chat/chat-room").ChatRoom>;
  CHAT_INBOX: DurableObjectNamespace<import("./chat/chat-inbox").ChatInbox>;
}

const decodeIdentityVars = Schema.decodeUnknownSync(IdentityVars, { onExcessProperty: "ignore" });

export const decodeIdentityEnv = (raw: Record<string, unknown>): IdentityEnv => {
  // Validate private RPC configuration without putting its value in a schema error.
  identityL2Configuration(raw as unknown as IdentityEnv);
  requireIdentityReadTargets(raw);
  const vars = decodeWithoutValues(raw);
  return {
    ...vars,
    DB: raw.DB as D1Database,
    ACCOUNT_LINKS: raw.ACCOUNT_LINKS as IdentityEnv["ACCOUNT_LINKS"],
    GUARDIAN: raw.GUARDIAN as Guardian,
    LAUNCH: raw.LAUNCH as IdentityEnv["LAUNCH"],
    RATING_READER: raw.RATING_READER as IdentityEnv["RATING_READER"],
    PUBLIC_RATE_LIMIT: raw.PUBLIC_RATE_LIMIT as RateLimit,
    DIRECTORY_RATE_LIMIT: raw.DIRECTORY_RATE_LIMIT as RateLimit,
    SIGN_IN_CODE_RATE_LIMIT: raw.SIGN_IN_CODE_RATE_LIMIT as RateLimit,
    VERSION: raw.VERSION as WorkerVersionMetadata,
    SHARD_NOTIFIER: raw.SHARD_NOTIFIER as IdentityEnv["SHARD_NOTIFIER"],
    CHAT_ROOM: raw.CHAT_ROOM as IdentityEnv["CHAT_ROOM"],
    CHAT_INBOX: raw.CHAT_INBOX as IdentityEnv["CHAT_INBOX"],
  };
};

const decodeWithoutValues = (raw: Record<string, unknown>) => {
  try {
    return decodeIdentityVars(raw);
  } catch {
    throw new Error("identity_environment_invalid");
  }
};
const requireIdentityReadTargets = (raw: Record<string, unknown>) => {
  for (const name of ["REALMS_ADDRESS", "RATING_TOKEN_ADDRESS"] as const) {
    const value = raw[name];
    if (
      typeof value !== "string" ||
      !/^0x[0-9a-fA-F]{1,64}$/.test(value) ||
      BigInt(value) <= 0n ||
      BigInt(value) >= (1n << 251n) - 256n
    )
      throw new Error(`${name} requires a nonzero contract address`);
  }
  let url: URL;
  try {
    url = new URL(String(raw.RATING_HISTORY_URL));
  } catch {
    throw new Error("RATING_HISTORY_URL requires HTTPS");
  }
  if (url.protocol !== "https:") throw new Error("RATING_HISTORY_URL requires HTTPS");
};

export const vapidKeysOf = (env: IdentityEnv) => ({
  publicKey: env.WEB_PUSH_VAPID_PUBLIC_KEY,
  privateKey: env.WEB_PUSH_VAPID_PRIVATE_KEY,
  subject: env.WEB_PUSH_VAPID_SUBJECT,
});
