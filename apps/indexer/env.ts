import { z } from "zod";

import { STARKNET_STREAM_NETWORKS } from "./streams";

const envSchema = z.object({
  // Version and chain info
  VITE_PUBLIC_CHAIN: z.enum(STARKNET_STREAM_NETWORKS),
  APIBARA_ETHEREUM_STREAM_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
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
