import type { SeasonAddresses } from "@bibliothecadao/eternum";

/** Valid chain identifiers */
export type Chain = "local" | "sepolia" | "mainnet" | "slot";

/**
 * Retrieves the season addresses for a specific chain
 * @param chain - The chain identifier
 * @returns The contract addresses for the specified chain
 * @throws Error if addresses cannot be loaded
 */
export async function getSeasonAddresses(chain: Chain): Promise<SeasonAddresses> {
  try {
    const seasonAddressesJson = await import(`../../contracts/common/addresses/${chain}.json`);
    return seasonAddressesJson.default;
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
export async function getGameManifest(chain: Chain): Promise<GameManifest> {
  try {
    const manifest = await import(`../../contracts/game/manifest_${chain}.json`);
    return manifest.default;
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}
