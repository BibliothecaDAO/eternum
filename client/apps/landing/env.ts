import { z } from "zod";

const envSchema = z.object({
  // Master account
  VITE_PUBLIC_MASTER_ADDRESS: z.string().startsWith("0x"),
  VITE_PUBLIC_MASTER_PRIVATE_KEY: z.string().startsWith("0x"),

  VITE_PUBLIC_ACCOUNT_CLASS_HASH: z.string().startsWith("0x"),
  VITE_PUBLIC_FEE_TOKEN_ADDRESS: z.string().startsWith("0x"),

  // Client fee recipient
  VITE_PUBLIC_CLIENT_FEE_RECIPIENT: z.string().startsWith("0x"),

  // API endpoints
  VITE_PUBLIC_TORII: z.string().url(),
  VITE_PUBLIC_NODE_URL: z.string().url(),
  VITE_PUBLIC_TORII_RELAY: z.string(),

  // Version and chain info
  VITE_PUBLIC_CHAIN: z.enum(["sepolia", "mainnet", "slot", "local"]), // Add other chains as needed

  VITE_PUBLIC_SLOT: z.string(),
  VITE_PUBLIC_GAME_TORII: z.string().url(),

  VITE_PUBLIC_SHOW_END_GAME_WARNING: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),

  VITE_PUBLIC_CHEST_DEBUG_MODE: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("false"),

  VITE_PUBLIC_BLOCK_CHEST_OPENING: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default("true"),
});

let env: z.infer<typeof envSchema>;
console.log(import.meta.env);
try {
  env = envSchema.parse(import.meta.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:", JSON.stringify(error.errors, null, 2));
  }
  throw new Error("Invalid environment variables");
}

export { env };
export const GAME_API_BASE_URL = env.VITE_PUBLIC_GAME_TORII;
