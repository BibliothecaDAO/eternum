import { Schema } from "effect";
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
  /** A Starknet mainnet RPC, for Sign in with Starknet signature checks. */
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
  /** The guardian Worker, reached by service binding only. */
  GUARDIAN: Guardian;
  PUBLIC_RATE_LIMIT: RateLimit;
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

export const decodeIdentityEnv = (raw: Record<string, unknown>): IdentityEnv => ({
  ...decodeIdentityVars(raw),
  DB: raw.DB as D1Database,
  GUARDIAN: raw.GUARDIAN as Guardian,
  PUBLIC_RATE_LIMIT: raw.PUBLIC_RATE_LIMIT as RateLimit,
  SIGN_IN_CODE_RATE_LIMIT: raw.SIGN_IN_CODE_RATE_LIMIT as RateLimit,
  VERSION: raw.VERSION as WorkerVersionMetadata,
  SHARD_NOTIFIER: raw.SHARD_NOTIFIER as IdentityEnv["SHARD_NOTIFIER"],
  CHAT_ROOM: raw.CHAT_ROOM as IdentityEnv["CHAT_ROOM"],
  CHAT_INBOX: raw.CHAT_INBOX as IdentityEnv["CHAT_INBOX"],
});

export const vapidKeysOf = (env: IdentityEnv) => ({
  publicKey: env.WEB_PUSH_VAPID_PUBLIC_KEY,
  privateKey: env.WEB_PUSH_VAPID_PRIVATE_KEY,
  subject: env.WEB_PUSH_VAPID_SUBJECT,
});
