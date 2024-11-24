import { IAgentRuntime } from "@ai16z/eliza";
import { z } from "zod";

export const starknetEnvSchema = z.object({
  STARKNET_INDEXER_URL: z.string().min(1, "Starknet indexer URL is required"),
  STARKNET_ADDRESS: z.string().min(1, "Starknet address is required"),
  STARKNET_PRIVATE_KEY: z.string().min(1, "Starknet private key is required"),
  STARKNET_RPC_URL: z.string().min(1, "Starknet RPC URL is required"),
});

export type StarknetConfig = z.infer<typeof starknetEnvSchema>;

export async function validateStarknetConfig(runtime: IAgentRuntime): Promise<StarknetConfig> {
  try {
    const config = {
      STARKNET_INDEXER_URL: runtime.getSetting("STARKNET_INDEXER_URL") || process.env.STARKNET_INDEXER_URL,

      STARKNET_ADDRESS: runtime.getSetting("STARKNET_ADDRESS") || process.env.STARKNET_ADDRESS,
      STARKNET_PRIVATE_KEY: runtime.getSetting("STARKNET_PRIVATE_KEY") || process.env.STARKNET_PRIVATE_KEY,
      STARKNET_RPC_URL: runtime.getSetting("STARKNET_RPC_URL") || process.env.STARKNET_RPC_URL,
    };

    return starknetEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(`Starknet configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}
