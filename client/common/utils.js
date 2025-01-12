/**
 * @typedef {Object} SeasonAddresses
 * @property {string} seasonPass - Address of the season pass contract
 * @property {string} realms - Address of the realms contract
 * @property {string} lords - Address of the LORDS token contract
 * @property {Object.<string, [number, string]>} resources - Map of resource name to [resourceId, contractAddress]
 * @example
 * {
 *   "seasonPass": "0x1234...",
 *   "realms": "0x5678...",
 *   "lords": "0x9abc...",
 *   "resources": {
 *     "STONE": [1, "0xdef0..."],
 *     ...
 *     "LORDS": [31, "0x9abc..."]
 *   }
 * }
 */

/**
 * Retrieves the season addresses for a specific chain
 * @param {string} chain - The chain identifier (e.g. 'local', 'goerli', etc.)
 * @returns {Promise<SeasonAddresses>} The contract addresses for the specified chain
 */
export async function getSeasonAddresses(chain){
  const ADDRESSES_FILE = `../../contracts/common/addresses/${chain}.json`;
  try {
    const seasonAddressesJson = (await import(ADDRESSES_FILE))
      .default;

    return seasonAddressesJson;
  } catch (error) {
    throw new Error(`Failed to load season addresses for chain ${chain}: ${error}`);
  }
}

/**
 * @typedef {Object} GameManifest
 * @property {*} [key] - Add your manifest properties here
 */

/**
 * Retrieves the game manifest for a specific chain
 * @param {string} chain - The chain identifier (e.g. 'local', 'goerli', etc.)
 * @returns {Promise<GameManifest>} The game manifest configuration
 */
export async function getGameManifest(chain){
  const MANIFEST_FILE = `../../contracts/game/manifest_${chain}.json`;
  try {
    const manifest = (await import(MANIFEST_FILE)).default;
    return manifest;
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}