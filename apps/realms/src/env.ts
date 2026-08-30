import { Schema } from "effect";

/**
 * Client environment, validated loudly at module load. The value plane and the
 * identity chain are the same Starknet mainnet, so one RPC URL serves both
 * (the name is shared with apps/web while both apps live in one .env).
 */
const ClientEnv = Schema.Struct({
  VITE_BASE_URL: Schema.NonEmptyString,
  VITE_PUBLIC_GAME_ORIGIN: Schema.NonEmptyString,
  VITE_PUBLIC_IDENTITY_RPC_URL: Schema.NonEmptyString,
  VITE_PUBLIC_HERALD_URL: Schema.NonEmptyString,
  VITE_PUBLIC_HERALD_CHAIN: Schema.NonEmptyString,
});

export const env = Schema.decodeUnknownSync(ClientEnv, { onExcessProperty: "ignore" })(import.meta.env);
