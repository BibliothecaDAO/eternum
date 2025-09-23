import localSeasonAddresses from "../../contracts/common/addresses/local.json";
import mainnetSeasonAddresses from "../../contracts/common/addresses/mainnet.json";
import sepoliaSeasonAddresses from "../../contracts/common/addresses/sepolia.json";
import slotSeasonAddresses from "../../contracts/common/addresses/slot.json";
import slottestSeasonAddresses from "../../contracts/common/addresses/slottest.json";
import localGameManifest from "../../contracts/game/manifest_local.json";
import mainnetGameManifest from "../../contracts/game/manifest_mainnet.json";
import sepoliaGameManifest from "../../contracts/game/manifest_sepolia.json";
import slotGameManifest from "../../contracts/game/manifest_slot.json";
import slottestGameManifest from "../../contracts/game/manifest_slottest.json";

/**
 * Interface representing season contract addresses and resources
 * @interface SeasonAddresses
 */
export interface SeasonAddresses {
  /** Class hash of the collectibles ERC721 contract */
  collectiblesClassHash?: string;
  /** Address of the village pass contract */
  villagePass: string;
  /** Address of the season pass contract */
  seasonPass: string;
  /** Address of the realms contract */
  realms: string;
  /** Address of the LORDS token contract */
  lords: string;
  /** Address of the loot chest contract */
  lootChests?: string;
  /** Address of the marketplace contract */
  marketplace?: string;
  /** Map of resource name to [resourceId, contractAddress] */
  resources: {
    [key: string]: (string | number)[];
  };
}

/** Valid chain identifiers */
export type Chain = "sepolia" | "mainnet" | "slot" | "slottest" | "local";

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
      case "slottest":
        return slottestSeasonAddresses;
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
      case "slottest":
        return slottestGameManifest;
      case "local":
        return localGameManifest;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}
