import type { Config } from "@bibliothecadao/types";
import localConfig from "../environments/data/local.json";
import mainnetConfig from "../environments/data/mainnet.json";
import sepoliaConfig from "../environments/data/sepolia.json";
import slotConfig from "../environments/data/slot.json";

/** Valid chain identifiers */
export type Chain = "sepolia" | "mainnet" | "slot" | "local";

/**
 * Loads the environment-specific configuration based on the network type.
 *
 * @remarks
 * Configuration files must follow these naming conventions:
 * - Located in environments/ directory
 * - Named exactly as the NetworkType: local.ts, sepolia.ts, slot.ts, mainnet.ts
 * - Must export a default Config object
 *
 * @throws {Error} If the configuration file cannot be loaded
 *
 * @example
 * ```typescript
 * const config = getConfigFromNetwork('local'); // loads from environments/local.ts
 * ```
 */
export function getConfigFromNetwork(chain: Chain): Config {
  try {
    switch (chain) {
      case "sepolia":
        return sepoliaConfig.configuration as any; // as any to avoid type errors
      case "mainnet":
        return mainnetConfig.configuration as any;
      case "slot":
        return slotConfig.configuration as any;
      case "local":
        return localConfig.configuration as any;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load configuration for chain ${chain}: ${error}`);
  }
}
