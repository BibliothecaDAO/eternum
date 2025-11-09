import { z } from "zod";

const envSchema = z.object({
  // Master account
  VITE_PUBLIC_MASTER_ADDRESS: z.string().startsWith("0x"),
  VITE_PUBLIC_MASTER_PRIVATE_KEY: z.string().startsWith("0x"),

  VITE_PUBLIC_ACCOUNT_CLASS_HASH: z.string().startsWith("0x"),
  VITE_PUBLIC_FEE_TOKEN_ADDRESS: z.string().startsWith("0x"),
  VITE_PUBLIC_ENTRY_TOKEN_ADDRESS: z
    .string()
    .startsWith("0x")
    .optional()
    .default("0x1e41641859757cd7c00c58456b367aeeb5c11a2e73049e303035969be7a6b0b"),

  VITE_PUBLIC_CLIENT_FEE_RECIPIENT: z.string().startsWith("0x"),

  // API endpoints
  VITE_PUBLIC_TORII: z.string().url(),
  VITE_PUBLIC_NODE_URL: z.string().url(),
  VITE_PUBLIC_TORII_RELAY: z.string(),
  VITE_PUBLIC_SCORE_TO_BEAT_TORII_ENDPOINTS: z.string().optional().default(""),
  // Optional external endpoints
  VITE_PUBLIC_CARTRIDGE_API_BASE: z.string().url().optional().default("https://api.cartridge.gg"),
  VITE_PUBLIC_TORII_CREATOR_URL: z
    .string()
    .url()
    .optional()
    .default("https://torii-creator.zerocredence.workers.dev/dispatch/torii"),
  VITE_PUBLIC_EXPLORER_MAINNET: z.string().url().optional().default("https://voyager.online"),
  VITE_PUBLIC_EXPLORER_SEPOLIA: z.string().url().optional().default("https://sepolia.voyager.online"),

  // Action Dispatcher
  VITE_PUBLIC_ACTION_DISPATCHER_URL: z.string().url().optional(),
  VITE_PUBLIC_ACTION_DISPATCHER_SECRET: z.string().optional(),

  VITE_PUBLIC_GRAPHICS_DEV: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),
  // Version and chain info
  VITE_PUBLIC_GAME_VERSION: z.string().optional().default(""),
  VITE_PUBLIC_CHAIN: z.enum(["sepolia", "mainnet", "slot", "slottest", "local"]), // Add other chains as needed

  VITE_PUBLIC_CONSTRUCTION_FLAG: z
    .string()
    .transform((v) => v === "true")
    .optional(),

  // VRF
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS: z.string().startsWith("0x").optional().default("0x0"),

  VITE_PUBLIC_SLOT: z.string(),

  // Social
  VITE_SOCIAL_LINK: z.string().url().optional().default(""),

  VITE_PUBLIC_MOBILE_VERSION_URL: z.string().url().optional().default("m.eternum.realms.world"),

  // timestamp
  VITE_PUBLIC_SEASON_START_TIME: z
    .string()
    .optional()
    .default("0")
    .transform((v) => Number(v)),

  VITE_PUBLIC_SETTLING_START_TIME: z
    .string()
    .optional()
    .default("0")
    .transform((v) => Number(v)),

  VITE_PUBLIC_SHOW_END_GAME_WARNING: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),
  VITE_PUBLIC_ENABLE_TOS: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),

  // PostHog
  VITE_PUBLIC_POSTHOG_KEY: z.string().optional(),
  VITE_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

  // Tracing Configuration
  VITE_TRACING_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),
  VITE_TRACING_ENDPOINT: z.string().url().optional().default("http://localhost:4318/v1/traces"),
  VITE_TRACING_SERVICE_NAME: z.string().optional().default("eternum-game"),
  VITE_TRACING_SAMPLE_RATE: z.string().optional().default("0.1"),
  VITE_TRACING_ERROR_SAMPLE_RATE: z.string().optional().default("1.0"),
  VITE_PERF_MONITORING_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
  VITE_PUBLIC_ENABLE_MEMORY_MONITORING: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),
  VITE_PERF_FPS_THRESHOLD: z.string().optional().default("30"),
  VITE_PERF_NETWORK_TIMEOUT: z.string().optional().default("5000"),

  // Tracing Authentication (optional - for cloud providers)
  VITE_TRACING_AUTH_HEADER: z.string().optional(),
  VITE_DATADOG_API_KEY: z.string().optional(),
  VITE_NEW_RELIC_LICENSE_KEY: z.string().optional(),
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(import.meta.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:", JSON.stringify(error.errors, null, 2));
  }
  throw new Error("Invalid environment variables");
}

export { env };

// Type for your validated env
export type Env = z.infer<typeof envSchema>;
