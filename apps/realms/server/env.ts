import { Schema } from "effect";

/**
 * Server environment, validated loudly at boot. DATABASE_URL is consumed by
 * @realms-world/db directly; it is validated here too so a misconfigured
 * service fails at startup, not on the first query.
 */
const ServerEnv = Schema.Struct({
  BETTER_AUTH_SECRET: Schema.NonEmptyString,
  DATABASE_URL: Schema.NonEmptyString,
  IDENTITY_RPC_URL: Schema.NonEmptyString,
  IDENTITY_COOKIE_DOMAIN: Schema.NonEmptyString,
  VITE_BASE_URL: Schema.NonEmptyString,
  VITE_PUBLIC_GAME_ORIGIN: Schema.NonEmptyString,
  GAME_RPC_URL: Schema.NonEmptyString,
  PLAYER_REGISTRY_ADDRESS: Schema.NonEmptyString,
  REALMS_SERVER_PORT: Schema.optionalWith(Schema.NumberFromString, { default: () => 3001 }),
});

export const serverEnv = Schema.decodeUnknownSync(ServerEnv, { onExcessProperty: "ignore" })(process.env);
