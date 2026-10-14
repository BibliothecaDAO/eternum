import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { resolveRendererBuildMode } from "./src/three/renderer-build-mode";

const url = Schema.String.check(Schema.makeFilter((value) => URL.canParse(value), { message: "Invalid url" }));
const booleanFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform((value) => value === "true"),
    encode: SchemaGetter.transform(String),
  }),
);
const numberFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform(Number),
    encode: SchemaGetter.transform(String),
  }),
);

const optionalUrlOrEmpty = Schema.optional(Schema.Union([url, Schema.Literal("")]));

const envSchema = Schema.Struct({
  VITE_PUBLIC_L2_RPC_URL: url,
  VITE_PUBLIC_RENDERER_BUILD_MODE: Schema.String.pipe(
    Schema.decodeTo(
      Schema.declare(
        (value): value is ReturnType<typeof resolveRendererBuildMode> =>
          typeof value === "string" && value === resolveRendererBuildMode(value),
      ),
      {
        decode: SchemaGetter.transform(resolveRendererBuildMode),
        encode: SchemaGetter.transform(String),
      },
    ),
    Schema.withDecodingDefault(Effect.succeed("webgpu-auto")),
  ),
  // Version
  VITE_PUBLIC_GAME_VERSION: Schema.String.pipe(Schema.withDecodingDefault(Effect.succeed(""))),

  VITE_PUBLIC_CONSTRUCTION_FLAG: Schema.optional(booleanFromString),

  // Social
  VITE_SOCIAL_LINK: optionalUrlOrEmpty.pipe(Schema.withDecodingDefault(Effect.succeed(""))),

  // Sentry — empty means "off"; CI passes "" when the secret is unset and
  // that must never white-screen the build.
  VITE_PUBLIC_SENTRY_DSN: optionalUrlOrEmpty.pipe(
    Schema.decode({
      decode: SchemaGetter.transform((value) => (value === "" ? undefined : value)),
      encode: SchemaGetter.transform((value) => value),
    }),
  ),
  VITE_PUBLIC_SENTRY_ENVIRONMENT: Schema.optional(Schema.String),
  VITE_PUBLIC_SENTRY_RELEASE: Schema.optional(Schema.String),
  VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: numberFromString.pipe(Schema.withDecodingDefault(Effect.succeed("1.0"))),
  VITE_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: numberFromString.pipe(
    Schema.withDecodingDefault(Effect.succeed("0.1")),
  ),
  VITE_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: numberFromString.pipe(
    Schema.withDecodingDefault(Effect.succeed("1.0")),
  ),
  VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII: booleanFromString.pipe(Schema.withDecodingDefault(Effect.succeed("true"))),
  VITE_PUBLIC_SENTRY_TX_FAILURES_ENABLED: booleanFromString.pipe(Schema.withDecodingDefault(Effect.succeed("true"))),
  VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE: numberFromString.pipe(Schema.withDecodingDefault(Effect.succeed("1.0"))),
  VITE_PUBLIC_SENTRY_TX_CAPTURE_USER_REJECTIONS: booleanFromString.pipe(
    Schema.withDecodingDefault(Effect.succeed("false")),
  ),
  VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY: Schema.Literals(["hashed", "raw", "none"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("hashed")),
  ),
  VITE_PUBLIC_SENTRY_NETWORK_HEALTH_ENABLED: booleanFromString.pipe(Schema.withDecodingDefault(Effect.succeed("true"))),

  // Debug monitoring must be opt-in.
  VITE_PUBLIC_ENABLE_MEMORY_MONITORING: booleanFromString.pipe(Schema.withDecodingDefault(Effect.succeed("false"))),

  VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS: numberFromString
    .pipe(Schema.withDecodingDefault(Effect.succeed("12000")))
    .check(
      Schema.makeFilter((value) => Number.isFinite(value) && value >= 0, {
        message: "VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS",
      }),
    ),
  VITE_PUBLIC_WORLDMAP_STREAMING_STAGED: booleanFromString.pipe(Schema.withDecodingDefault(Effect.succeed("true"))),
  VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING: booleanFromString.pipe(Schema.withDecodingDefault(Effect.succeed("true"))),
  VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING_TELEMETRY: booleanFromString.pipe(
    Schema.withDecodingDefault(Effect.succeed("true")),
  ),
});

type PublicEnv = typeof envSchema.Type;

const resolveValidatedPublicEnv = (): PublicEnv =>
  Schema.decodeUnknownSync(envSchema, { errors: "all" })({ ...import.meta.env });

let env: PublicEnv;
try {
  env = resolveValidatedPublicEnv();
} catch (error) {
  console.error("❌ Invalid environment variables:", error);
  throw new Error("Invalid environment variables");
}

export { env };
