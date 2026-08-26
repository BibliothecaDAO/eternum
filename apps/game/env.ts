import { z } from "zod";
import { resolveRendererBuildMode } from "./src/three/renderer-build-mode";

const _rawEnv = import.meta.env as Record<string, string | undefined>;

const optionalUrlOrEmpty = z.union([z.string().url(), z.literal("")]).optional();

const envSchema = z
  .object({
    // Master account
    VITE_PUBLIC_MASTER_ADDRESS: z.string().startsWith("0x").optional(),
    VITE_PUBLIC_MASTER_PRIVATE_KEY: z.string().startsWith("0x").optional(),

    VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH: z.string().startsWith("0x"),
    VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS: z.string().startsWith("0x"),
    VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS: z.string().startsWith("0x"),
    VITE_PUBLIC_FEE_TOKEN_ADDRESS: z.string().startsWith("0x"),

    // API endpoints
    // No implicit defaults: endpoints are chain-specific and must come from the
    // active `.env.<chain>.<game>` file.
    VITE_PUBLIC_TORII: optionalUrlOrEmpty.default(""),
    // Eternum-world torii; empty = the eternum world is absent from the directory.
    VITE_PUBLIC_TORII_ETERNUM: optionalUrlOrEmpty.default(""),
    VITE_PUBLIC_NODE_URL: optionalUrlOrEmpty.default(""),
    VITE_PUBLIC_IDENTITY_ORIGIN: z.string().url(),
    VITE_PUBLIC_IDENTITY_RPC_URL: z.string().url(),
    VITE_PUBLIC_FACTORY_WORKER_URL: z
      .string()
      .url()
      .optional()
      .default("https://realms-game-launch.zerocredence.workers.dev"),
    VITE_PUBLIC_EXPLORER_URL: optionalUrlOrEmpty.default(""),
    // Empty = no realtime-server for this deployment; consumers skip their
    // calls instead of hammering a dead endpoint.
    VITE_PUBLIC_REALTIME_URL: optionalUrlOrEmpty.default(""),
    // Empty = chat is deliberately unavailable for this environment. Chat has
    // its own endpoint and must never inherit the deployment/realtime service.
    VITE_PUBLIC_CHAT_URL: optionalUrlOrEmpty.default(""),
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
    // Version and chain info
    VITE_PUBLIC_GAME_VERSION: z.string().optional().default(""),
    VITE_PUBLIC_CHAIN: z.enum(["madara", "appchain"]).optional().default("madara"),

    VITE_PUBLIC_CONSTRUCTION_FLAG: z
      .string()
      .transform((v) => v === "true")
      .optional(),

    // VRF
    VITE_PUBLIC_VRF_PROVIDER_ADDRESS: z.string().startsWith("0x").optional().default("0x0"),

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

    // Debug monitoring must be opt-in — see the note on TORII_BOUNDS_DEBUG below.
    VITE_PUBLIC_ENABLE_MEMORY_MONITORING: z
      .string()
      .transform((v) => v === "true")
      .optional()
      .default("false"),

    // Debug logging must be opt-in — a defaulted-true flag spams every build
    // that forgets to set it.
    VITE_PUBLIC_TORII_BOUNDS_DEBUG: z
      .string()
      .transform((v) => v === "true")
      .optional()
      .default("false"),
    VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS: z
      .string()
      .optional()
      .default("8000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS"),
    VITE_PUBLIC_TORII_SNAPSHOT_PAGE_TIMEOUT_MS: z
      .string()
      .optional()
      .default("15000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_TORII_SNAPSHOT_PAGE_TIMEOUT_MS"),
    VITE_PUBLIC_TORII_EVENT_REPLAY_PAGE_TIMEOUT_MS: z
      .string()
      .optional()
      .default("10000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_TORII_EVENT_REPLAY_PAGE_TIMEOUT_MS"),
    VITE_PUBLIC_TORII_PAGE_RETRY_COUNT: z
      .string()
      .optional()
      .default("2")
      .transform((v) => Number(v))
      .refine((value) => Number.isInteger(value) && value >= 0, "VITE_PUBLIC_TORII_PAGE_RETRY_COUNT"),
    // How long without a Torii indexer heartbeat before a stream is treated as
    // stale. Lower = faster detection of a silently-dropped stream.
    VITE_PUBLIC_TORII_STALE_THRESHOLD_MS: z
      .string()
      .optional()
      .default("8000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value > 0, "VITE_PUBLIC_TORII_STALE_THRESHOLD_MS"),
    // Cadence of the lightweight heartbeat watchdog (decoupled from the heavier
    // HTTP health probe) so staleness is caught in seconds, not a probe interval.
    // 0 disables the watchdog (falls back to probe-driven detection only).
    VITE_PUBLIC_TORII_HEARTBEAT_WATCHDOG_INTERVAL_MS: z
      .string()
      .optional()
      .default("3000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_TORII_HEARTBEAT_WATCHDOG_INTERVAL_MS"),
    // Adaptive reconnect backoff: first retry waits min, then doubles up to max.
    // Replaces the flat 60s cooldown so a transient drop recovers in ~1s while a
    // genuinely-down server still backs off. min<=0 disables adaptive backoff.
    VITE_PUBLIC_TORII_RECONNECT_MIN_COOLDOWN_MS: z
      .string()
      .optional()
      .default("1000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_TORII_RECONNECT_MIN_COOLDOWN_MS"),
    VITE_PUBLIC_TORII_RECONNECT_MAX_COOLDOWN_MS: z
      .string()
      .optional()
      .default("30000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_TORII_RECONNECT_MAX_COOLDOWN_MS"),
    // Last-resort refresh for cancel-only streams when SubscribeIndexer heartbeat
    // is unavailable. Healthy heartbeat-backed sessions never use it. 0 disables.
    VITE_PUBLIC_TORII_QUIET_STREAM_REFRESH_MS: z
      .string()
      .optional()
      .default("120000")
      .transform((v) => Number(v))
      .refine((value) => Number.isFinite(value) && value >= 0, "VITE_PUBLIC_TORII_QUIET_STREAM_REFRESH_MS"),
    // Reconnect by re-opening only the global stream (cheap) instead of a full
    // initialSync re-bootstrap. Falls back to full re-bootstrap when false.
    VITE_PUBLIC_TORII_LIGHTWEIGHT_RECONNECT: z
      .string()
      .transform((v) => v === "true")
      .optional()
      .default("true"),
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
    VITE_PUBLIC_ETERNUM_UNIFIED_SETTLEMENT_PLANNER: z
      .string()
      .transform((v) => v === "true")
      .optional()
      .default("true"),
  })
  .superRefine((value, context) => {
    const hasMasterAddress = Boolean(value.VITE_PUBLIC_MASTER_ADDRESS);
    const hasMasterPrivateKey = Boolean(value.VITE_PUBLIC_MASTER_PRIVATE_KEY);
    if (value.VITE_PUBLIC_CHAIN === "appchain" && (!hasMasterAddress || !hasMasterPrivateKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Appchain builds require both VITE_PUBLIC_MASTER_ADDRESS and VITE_PUBLIC_MASTER_PRIVATE_KEY",
        path: ["VITE_PUBLIC_MASTER_ADDRESS"],
      });
    }
    if (value.VITE_PUBLIC_CHAIN === "madara" && (hasMasterAddress || hasMasterPrivateKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Madara builds must not configure appchain master credentials",
        path: ["VITE_PUBLIC_MASTER_ADDRESS"],
      });
    }
  });

type PublicEnv = z.infer<typeof envSchema>;

export const parsePublicEnv = (input: Record<string, string | undefined> = import.meta.env): PublicEnv => {
  return envSchema.parse({ ...input });
};

const resolveValidatedPublicEnv = (): PublicEnv => {
  const parsedEnv = parsePublicEnv();
  return parsedEnv;
};

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
