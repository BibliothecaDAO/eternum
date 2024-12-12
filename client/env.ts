import { z } from "zod";

const envSchema = z.object({
  // Master account
  VITE_PUBLIC_MASTER_ADDRESS: z.string().startsWith("0x"),
  VITE_PUBLIC_MASTER_PRIVATE_KEY: z.string().startsWith("0x"),

  // Contract addresses
  VITE_PUBLIC_WORLD_ADDRESS: z.string().startsWith("0x"),
  VITE_PUBLIC_ACCOUNT_CLASS_HASH: z.string().startsWith("0x"),
  VITE_PUBLIC_FEE_TOKEN_ADDRESS: z.string().startsWith("0x"),

  VITE_PUBLIC_CLIENT_FEE_RECIPIENT: z.string().startsWith("0x"),

  // External Contracts
  VITE_SEASON_PASS_ADDRESS: z.string().startsWith("0x"),
  VITE_REALMS_ADDRESS: z.string().startsWith("0x"),
  VITE_LORDS_ADDRESS: z.string().startsWith("0x"),

  // API endpoints
  VITE_PUBLIC_TORII: z.string().url(),
  VITE_PUBLIC_NODE_URL: z.string().url(),
  VITE_PUBLIC_TORII_RELAY: z.string(),

  // Configuration flags
  VITE_PUBLIC_DEV: z.string().transform((v) => v === "true"),
  VITE_PUBLIC_SHOW_FPS: z.string().transform((v) => v === "true"),
  VITE_PUBLIC_GRAPHICS_DEV: z.string().transform((v) => v === "true"),
  // Version and chain info
  VITE_PUBLIC_GAME_VERSION: z.string(),
  VITE_PUBLIC_CHAIN: z.enum(["sepolia", "mainnet", "testnet", "local"]), // Add other chains as needed

  VITE_PUBLIC_CONSTRUCTION_FLAG: z.string().transform((v) => v === "true"),
  VITE_PUBLIC_HIDE_THREEJS_MENU: z.string().transform((v) => v === "true"),

  // VRF
  VITE_VRF_PROVIDER_ADDRESS: z.string().startsWith("0x"),

  // Ark Marketplace API
  VITE_PUBLIC_ARK_MARKETPLACE_API: z.string().url(),
  VITE_PUBLIC_IMAGE_CDN_URL: z.string().url(),
  VITE_PUBLIC_IMAGE_PROXY_URL: z.string().url(),
  VITE_PUBLIC_IPFS_GATEWAY: z.string().url(),

  VITE_PUBLIC_SLOT: z.string(),

  // Social
  VITE_SOCIAL_LINK: z.string().url(),
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
