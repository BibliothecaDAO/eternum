import { z } from "zod";
import { resolveRendererBuildMode } from "./src/three/renderer-build-mode";

const _rawEnv = import.meta.env as Record<string, string | undefined>;

const optionalUrlOrEmpty = z.union([z.string().url(), z.literal("")]).optional();

const envSchema = z.object({
  // The shard this build opens by default. Its manifest names the chain, node, admission service and
  // contracts; shards the player pastes are opened the same way.
  VITE_PUBLIC_SHARD_URL: z.string().url(),
  VITE_PUBLIC_IDENTITY_RPC_URL: z.string().url(),
  // Optional public mainnet RPC handed to the cross-origin Controller keychain, which cannot fetch
  // a loopback host (Private Network Access); the lab therefore points it at a public node.
  VITE_PUBLIC_CONTROLLER_RPC_URL: z.string().url().optional(),
  VITE_PUBLIC_EXPLORER_URL: optionalUrlOrEmpty.default(""),
  VITE_PUBLIC_ENABLE_SQL_CACHE: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),

  // Marketplace API endpoint (added)
  VITE_PUBLIC_MARKETPLACE_URL: optionalUrlOrEmpty.default(""),

  VITE_PUBLIC_GRAPHICS_DEV: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),
  VITE_PUBLIC_RENDERER_BUILD_MODE: z.string().optional().default("webgpu-auto").transform(resolveRendererBuildMode),
  // Version
  VITE_PUBLIC_GAME_VERSION: z.string().optional().default(""),

  VITE_PUBLIC_CONSTRUCTION_FLAG: z
    .string()
    .transform((v) => v === "true")
    .optional(),

  // Social
  VITE_SOCIAL_LINK: optionalUrlOrEmpty.default(""),

  VITE_PUBLIC_SEASON_START_TIME: z
    .string()
    .optional()
    .default("0")
    .transform((v) => Number(v)),

  VITE_PUBLIC_CHEST_OPENING_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),

  // Sentry — empty means "off"; CI passes "" when the secret is unset and
  // that must never white-screen the build.
  VITE_PUBLIC_SENTRY_DSN: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  VITE_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
  VITE_PUBLIC_SENTRY_RELEASE: z.string().optional(),
  VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z
    .string()
    .optional()
    .default("1.0")
    .transform((v) => Number(v)),
  VITE_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z
    .string()
    .optional()
    .default("0.1")
    .transform((v) => Number(v)),
  VITE_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: z
    .string()
    .optional()
    .default("1.0")
    .transform((v) => Number(v)),
  VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
  VITE_PUBLIC_SENTRY_TX_FAILURES_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
  VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE: z
    .string()
    .optional()
    .default("1.0")
    .transform((v) => Number(v)),
  VITE_PUBLIC_SENTRY_TX_CAPTURE_USER_REJECTIONS: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),
  VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY: z.enum(["hashed", "raw", "none"]).optional().default("hashed"),
  VITE_PUBLIC_SENTRY_NETWORK_HEALTH_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
  VITE_PUBLIC_SENTRY_NETWORK_HEALTH_MIN_OUTAGE_MS: z
    .string()
    .optional()
    .default("10000")
    .transform((v) => Number(v)),
  VITE_PUBLIC_SENTRY_NETWORK_HEALTH_MAX_PER_SESSION: z
    .string()
    .optional()
    .default("50")
    .transform((v) => Number(v)),

  // Debug monitoring must be opt-in.
  VITE_PUBLIC_ENABLE_MEMORY_MONITORING: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),

  VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS: z
    .string()
    .optional()
    .default("12000")
    .transform((v) => Number(v))
    .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS"),
  VITE_PUBLIC_WORLDMAP_STREAMING_STAGED: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
  VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
  VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING_TELEMETRY: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
});

type PublicEnv = z.infer<typeof envSchema>;

const resolveValidatedPublicEnv = (): PublicEnv => envSchema.parse({ ...import.meta.env });

let env: PublicEnv;
try {
  env = resolveValidatedPublicEnv();
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:", JSON.stringify(error.errors, null, 2));
  } else {
    console.error("❌ Invalid environment variables:", error);
  }
  throw new Error("Invalid environment variables");
}

export { env };
