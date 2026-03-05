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

const processEnv =
  typeof process !== "undefined" && process.env ? process.env : {};

const isTruthy = (value: unknown): boolean =>
  value === true || value === "true" || value === "1";

const isCiLikeEnvironment =
  isTruthy(import.meta.env.CI) ||
  isTruthy(processEnv.CI) ||
  isTruthy(processEnv.VERCEL);

const rawEnv = {
  VITE_PUBLIC_CHAIN:
    import.meta.env.VITE_PUBLIC_CHAIN ?? processEnv.VITE_PUBLIC_CHAIN,
  VITE_BASE_URL: import.meta.env.VITE_BASE_URL ?? processEnv.VITE_BASE_URL,
  VITE_PUBLIC_IMAGE_CDN_URL:
    import.meta.env.VITE_PUBLIC_IMAGE_CDN_URL ??
    processEnv.VITE_PUBLIC_IMAGE_CDN_URL,
  VITE_PUBLIC_IMAGE_PROXY_URL:
    import.meta.env.VITE_PUBLIC_IMAGE_PROXY_URL ??
    processEnv.VITE_PUBLIC_IMAGE_PROXY_URL,
  VITE_PUBLIC_IPFS_GATEWAY:
    import.meta.env.VITE_PUBLIC_IPFS_GATEWAY ??
    processEnv.VITE_PUBLIC_IPFS_GATEWAY,
  VITE_TORII_API_URL:
    import.meta.env.VITE_TORII_API_URL ?? processEnv.VITE_TORII_API_URL,
  VITE_PUBLIC_SLOT:
    import.meta.env.VITE_PUBLIC_SLOT ?? processEnv.VITE_PUBLIC_SLOT,
  VITE_PUBLIC_NODE_URL:
    import.meta.env.VITE_PUBLIC_NODE_URL ?? processEnv.VITE_PUBLIC_NODE_URL,
  VITE_RESERVOIR_API_KEY:
    import.meta.env.VITE_RESERVOIR_API_KEY ?? processEnv.VITE_RESERVOIR_API_KEY,
  VITE_ALCHEMY_API_KEY:
    import.meta.env.VITE_ALCHEMY_API_KEY ?? processEnv.VITE_ALCHEMY_API_KEY,
  VITE_DUNE_API_KEY:
    import.meta.env.VITE_DUNE_API_KEY ?? processEnv.VITE_DUNE_API_KEY,
  VITE_ETHPLORER_APIKEY:
    import.meta.env.VITE_ETHPLORER_APIKEY ?? processEnv.VITE_ETHPLORER_APIKEY,
};

const envInput = isCiLikeEnvironment
  ? {
    ...rawEnv,
    VITE_PUBLIC_CHAIN: rawEnv.VITE_PUBLIC_CHAIN ?? "mainnet",
    VITE_PUBLIC_SLOT: rawEnv.VITE_PUBLIC_SLOT ?? "ci",
    VITE_ALCHEMY_API_KEY: rawEnv.VITE_ALCHEMY_API_KEY ?? "ci",
    VITE_TORII_API_URL:
      rawEnv.VITE_TORII_API_URL ??
      "https://api.cartridge.gg/x/eternum-marketplace-mainnet19/torii",
  }
  : rawEnv;

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
