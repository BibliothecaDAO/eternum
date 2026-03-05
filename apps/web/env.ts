import { z } from "zod";

const envSchema = z.object({
  // Version and chain info
  VITE_PUBLIC_CHAIN: z.enum(["sepolia", "mainnet", "testnet", "local"]), // Add other chains as needed
  VITE_BASE_URL: z.string().url().optional(),
  VITE_PUBLIC_IMAGE_CDN_URL: z.string().url().optional(),
  VITE_PUBLIC_IMAGE_PROXY_URL: z.string().url().optional(),
  VITE_PUBLIC_IPFS_GATEWAY: z.string().url().optional(),
  VITE_TORII_API_URL: z.string().url().optional(),
  VITE_PUBLIC_SLOT: z.string(),
  VITE_PUBLIC_NODE_URL: z.string().url().optional(),

  VITE_RESERVOIR_API_KEY: z.string().optional(),
  VITE_ALCHEMY_API_KEY: z.string(),
  VITE_DUNE_API_KEY: z.string().optional(),
  VITE_ETHPLORER_APIKEY: z.string().optional()
});

const isCiBuild = import.meta.env.CI === true || import.meta.env.CI === "true";
const envInput = isCiBuild
  ? {
    ...import.meta.env,
    VITE_PUBLIC_CHAIN: import.meta.env.VITE_PUBLIC_CHAIN ?? "mainnet",
    VITE_PUBLIC_SLOT: import.meta.env.VITE_PUBLIC_SLOT ?? "ci",
    VITE_ALCHEMY_API_KEY: import.meta.env.VITE_ALCHEMY_API_KEY ?? "ci",
  }
  : import.meta.env;

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(envInput);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(
      "❌ Invalid environment variables:",
      JSON.stringify(error.errors, null, 2),
    );
  }
  throw new Error("Invalid environment variables");
}

export { env };

// Type for your validated env
export type Env = z.infer<typeof envSchema>;
