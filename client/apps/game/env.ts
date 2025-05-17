import { z } from "zod";

const envSchema = z.object({
  // Master account
  VITE_PUBLIC_MASTER_ADDRESS: z.string().startsWith("0x"),
  VITE_PUBLIC_MASTER_PRIVATE_KEY: z.string().startsWith("0x"),

  VITE_PUBLIC_ACCOUNT_CLASS_HASH: z.string().startsWith("0x"),
  VITE_PUBLIC_FEE_TOKEN_ADDRESS: z.string().startsWith("0x"),

  VITE_PUBLIC_CLIENT_FEE_RECIPIENT: z.string().startsWith("0x"),

  // API endpoints
  VITE_PUBLIC_TORII: z.string().url(),
  VITE_PUBLIC_NODE_URL: z.string().url(),
  VITE_PUBLIC_TORII_RELAY: z.string(),

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
  VITE_PUBLIC_CHAIN: z.enum(["sepolia", "mainnet", "slot", "local"]), // Add other chains as needed

  VITE_PUBLIC_CONSTRUCTION_FLAG: z
    .string()
    .transform((v) => v === "true")
    .optional(),

  // VRF
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS: z.string().startsWith("0x").optional().default("0x0"),

  VITE_PUBLIC_SLOT: z.string(),

  // Social
  VITE_SOCIAL_LINK: z.string().url().optional().default(""),

  VITE_PUBLIC_MOBILE_VERSION_URL: z.string().url().optional().default("eternum-mobile.realms.world"),

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
