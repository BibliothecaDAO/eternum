import playerAccount from "../../../contracts/l3/player-account/class-hash.json";
import { Schema } from "effect";
import { identityL2Configuration } from "./l2";
import type { Guardian } from "@realms-world/guardian";

/**
 * The identity Worker's environment. Plain values are decoded loudly, so a misconfigured deployment fails on its first
 * request instead of answering with defaults. Secrets (`BETTER_AUTH_SECRET`, `L2_RPC_URL`,
 * `OPERATOR_TOKEN`, the `WEB_PUSH_VAPID_*` keys, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `RESEND_API_KEY`) are set
 * per environment and never committed.
 */
const IdentityVars = Schema.Struct({
  ENVIRONMENT: Schema.Literals(["staging", "production"]),
  /** The app's origin; identity is served under its /api. */
  BASE_URL: Schema.NonEmptyString,
  BETTER_AUTH_SECRET: Schema.NonEmptyString,
  /** Only the configured chain's HTTPS Alchemy RPC is accepted. */
  L2_RPC_URL: Schema.NonEmptyString,
  /** The marketplace API (its base, before `/v1`): the Realm holdings index, and at `/rpc` the relay for point reads. */
  MARKETPLACE_API_URL: Schema.String.pipe(Schema.check(Schema.isPattern(/^https:\/\/[^/]+/))),
  /** The environment's one operator token for all automation: listing shards and changing their status here. */
  OPERATOR_TOKEN: Schema.NonEmptyString,
  /** The Discord application players sign in with; its redirect is {BASE_URL}/api/auth/callback/discord. */
  DISCORD_CLIENT_ID: Schema.optional(Schema.String),
  DISCORD_CLIENT_SECRET: Schema.optional(Schema.String),
  /** The email provider's key, for one-time sign-in codes. */
  RESEND_API_KEY: Schema.NonEmptyString,
  /** The environment's VAPID key pair (base64url) and contact, which sign every web push. */
  WEB_PUSH_VAPID_PUBLIC_KEY: Schema.NonEmptyString,
  WEB_PUSH_VAPID_PRIVATE_KEY: Schema.NonEmptyString,
});

export interface IdentityEnv extends Schema.Schema.Type<typeof IdentityVars> {
  DB: D1Database;
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
  const vars = decodeWithoutValues(raw);
  return {
    ...vars,
    DB: raw.DB as D1Database,
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
export const vapidKeysOf = (env: IdentityEnv) => ({
  publicKey: env.WEB_PUSH_VAPID_PUBLIC_KEY,
  privateKey: env.WEB_PUSH_VAPID_PRIVATE_KEY,
  subject: "mailto:ops@realms.party",
});

export const ACCOUNT_CLASS_HASH = playerAccount.accountClassHash;

export const socialProvidersOf = (env: Pick<IdentityEnv, "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET">) =>
  env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
    ? { discord: { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET } }
    : {};
