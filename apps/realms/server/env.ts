import playerAccount from "../../../contracts/l3/player-account/class-hash.json";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@realms-world/identity";
import { Schema } from "effect";
import { identityL2Configuration } from "./l2";
import type { Guardian } from "@realms-world/guardian";

/**
 * The identity Worker's environment. Plain values are decoded loudly, so a misconfigured deployment fails on its first
 * request instead of answering with defaults. Secrets (`BETTER_AUTH_SECRET`, `L2_RPC_URL`,
 * `OPERATOR_TOKEN`, the `WEB_PUSH_VAPID_*` keys, each sign-in provider's `<PROVIDER>_CLIENT_ID` and
 * `<PROVIDER>_CLIENT_SECRET`, `RESEND_API_KEY`) are set per environment and never committed. `AVNU_PAYMASTER_API_KEY` sponsors default wallets' recovery steps; setup's
 * apply installs it from `avnuPaymasterApiKey` in the environment's inputs.json when present. Without it a default wallet
 * still receives and sends (paying its own fee in LORDS), and a recovery is refused with SPONSOR_UNAVAILABLE.
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
  /**
   * The OAuth clients players sign in with, each optional and offered only as a pair; each one's redirect is
   * {BASE_URL}/api/auth/callback/<provider>. Apple's secret is the JWT `scripts/apple-client-secret.ts` signs.
   */
  GOOGLE_CLIENT_ID: Schema.optional(Schema.String),
  GOOGLE_CLIENT_SECRET: Schema.optional(Schema.String),
  APPLE_CLIENT_ID: Schema.optional(Schema.String),
  APPLE_CLIENT_SECRET: Schema.optional(Schema.String),
  DISCORD_CLIENT_ID: Schema.optional(Schema.String),
  DISCORD_CLIENT_SECRET: Schema.optional(Schema.String),
  TWITTER_CLIENT_ID: Schema.optional(Schema.String),
  TWITTER_CLIENT_SECRET: Schema.optional(Schema.String),
  /** The email provider's key, for one-time sign-in codes. */
  RESEND_API_KEY: Schema.NonEmptyString,
  /** The environment's VAPID key pair (base64url) and contact, which sign every web push. */
  WEB_PUSH_VAPID_PUBLIC_KEY: Schema.NonEmptyString,
  WEB_PUSH_VAPID_PRIVATE_KEY: Schema.NonEmptyString,
  /** AVNU's paymaster key: it sponsors default wallets' recovery steps (server/paymaster.ts). */
  AVNU_PAYMASTER_API_KEY: Schema.optional(Schema.NonEmptyString),
});

export interface IdentityEnv extends Schema.Schema.Type<typeof IdentityVars> {
  DB: D1Database;
  /** The guardian Worker, reached by service binding only. */
  GUARDIAN: Guardian;
  /** The launch Worker, reached by service binding only. */
  LAUNCH: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  /** The value relay, reached by service binding only: it turns a founded Devcon home golden for its inviter's friends. */
  VALUE_RELAY: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
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
  /** Shared links' cards, one per link, which the links unfurl as (share-cards.ts). */
  SHARE_CARDS: import("./share-cards").ShareCards;
}

const decodeIdentityVars = Schema.decodeUnknownSync(IdentityVars, { onExcessProperty: "ignore" });

export const decodeIdentityEnv = (raw: Record<string, unknown>): IdentityEnv => {
  // Validate private RPC configuration without putting its value in a schema error.
  identityL2Configuration(raw as unknown as IdentityEnv);
  const vars = decodeWithoutValues(raw);
  socialProvidersOf(vars);
  return {
    ...vars,
    DB: raw.DB as D1Database,
    GUARDIAN: raw.GUARDIAN as Guardian,
    LAUNCH: raw.LAUNCH as IdentityEnv["LAUNCH"],
    VALUE_RELAY: raw.VALUE_RELAY as IdentityEnv["VALUE_RELAY"],
    RATING_READER: raw.RATING_READER as IdentityEnv["RATING_READER"],
    PUBLIC_RATE_LIMIT: raw.PUBLIC_RATE_LIMIT as RateLimit,
    DIRECTORY_RATE_LIMIT: raw.DIRECTORY_RATE_LIMIT as RateLimit,
    SIGN_IN_CODE_RATE_LIMIT: raw.SIGN_IN_CODE_RATE_LIMIT as RateLimit,
    VERSION: raw.VERSION as WorkerVersionMetadata,
    SHARD_NOTIFIER: raw.SHARD_NOTIFIER as IdentityEnv["SHARD_NOTIFIER"],
    CHAT_ROOM: raw.CHAT_ROOM as IdentityEnv["CHAT_ROOM"],
    CHAT_INBOX: raw.CHAT_INBOX as IdentityEnv["CHAT_INBOX"],
    SHARE_CARDS: raw.SHARE_CARDS as IdentityEnv["SHARE_CARDS"],
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

/** Each provider's OAuth client, as the environment names its two secrets. */
export type SocialCredentials = {
  readonly [P in SocialProvider as `${Uppercase<P>}_CLIENT_ID` | `${Uppercase<P>}_CLIENT_SECRET`]?: string | undefined;
};
interface SocialClient {
  clientId: string;
  clientSecret: string;
}

/**
 * The providers whose OAuth client is configured, in the sheet's order. A provider with one of its two secrets set is a
 * misconfiguration, never a provider quietly left off: it fails the environment, naming the provider and not the value.
 */
export const socialProvidersOf = (env: SocialCredentials): Partial<Record<SocialProvider, SocialClient>> =>
  Object.fromEntries(
    SOCIAL_PROVIDERS.flatMap((provider) => {
      const client = socialClientOf(env, provider);
      return client ? [[provider, client]] : [];
    }),
  );

const socialClientOf = (env: SocialCredentials, provider: SocialProvider): SocialClient | null => {
  const name = provider.toUpperCase() as Uppercase<SocialProvider>;
  const clientId = env[`${name}_CLIENT_ID`];
  const clientSecret = env[`${name}_CLIENT_SECRET`];
  if (!clientId && !clientSecret) return null;
  if (!clientId || !clientSecret)
    throw new Error(`identity_environment_invalid: ${name}_CLIENT_ID and ${name}_CLIENT_SECRET are set together`);
  return { clientId, clientSecret };
};
