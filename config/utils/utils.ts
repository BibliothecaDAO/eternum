import type { Config, SeasonAddresses } from "@bibliothecadao/eternum";
import localSeasonAddresses from "../../contracts/common/addresses/local.json";
import mainnetSeasonAddresses from "../../contracts/common/addresses/mainnet.json";
import sepoliaSeasonAddresses from "../../contracts/common/addresses/sepolia.json";
import slotSeasonAddresses from "../../contracts/common/addresses/slot.json";
import localGameManifest from "../../contracts/game/manifest_local.json";
import mainnetGameManifest from "../../contracts/game/manifest_mainnet.json";
import sepoliaGameManifest from "../../contracts/game/manifest_sepolia.json";
import slotGameManifest from "../../contracts/game/manifest_slot.json";

import localConfig from "../environments/data/local.json";
import mainnetConfig from "../environments/data/mainnet.json";
import sepoliaConfig from "../environments/data/sepolia.json";
import slotConfig from "../environments/data/slot.json";

/** Valid chain identifiers */
export type Chain = "sepolia" | "mainnet" | "slot" | "local";

/**
 * Retrieves the season addresses for a specific chain
 * @param chain - The chain identifier
 * @returns The contract addresses for the specified chain
 * @throws Error if addresses cannot be loaded
 */
export function getSeasonAddresses(chain: Chain): SeasonAddresses {
  try {
    switch (chain) {
      case "sepolia":
        return sepoliaSeasonAddresses;
      case "mainnet":
        return mainnetSeasonAddresses;
      case "slot":
        return slotSeasonAddresses;
      case "local":
        return localSeasonAddresses;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load season addresses for chain ${chain}: ${error}`);
  }
}

/**
 * Interface representing the game manifest configuration
 * @interface GameManifest
 */
interface GameManifest {
  [key: string]: unknown;
}

/**
 * Retrieves the game manifest for a specific chain
 * @param chain - The chain identifier
 * @returns The game manifest configuration
 * @throws Error if manifest cannot be loaded
 */
export function getGameManifest(chain: Chain): GameManifest {
  try {
    switch (chain) {
      case "sepolia":
        return sepoliaGameManifest;
      case "mainnet":
        return mainnetGameManifest;
      case "slot":
        return slotGameManifest;
      case "local":
        return localGameManifest;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}

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
        return sepoliaConfig.configuration;
      case "mainnet":
        return mainnetConfig.configuration;
      case "slot":
        return slotConfig.configuration ;
      case "local":
        return localConfig.configuration;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load configuration for chain ${chain}: ${error}`);
  }
}
