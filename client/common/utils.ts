/** Valid chain identifiers */
export type Chain = "local" | "sepolia" | "mainnet" | "slot";

/**
 * Retrieves the season addresses for a specific chain
 * @param chain - The chain identifier
 * @returns The contract addresses for the specified chain
 * @throws Error if addresses cannot be loaded
 */
export async function getSeasonAddresses(chain: Chain): Promise<SeasonAddresses> {
  const ADDRESSES_FILE = `../../contracts/common/addresses/${chain}.json`;
  try {
    const seasonAddressesJson = (await import(ADDRESSES_FILE)).default;

    return seasonAddressesJson;
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
  const MANIFEST_FILE = `../../contracts/game/manifest_${chain}.json`;
  try {
    const manifest = (await import(MANIFEST_FILE)).default;
    return manifest;
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}
