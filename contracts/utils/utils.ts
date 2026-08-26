import type { GameChain } from "@realms-world/chain";
import appchainSeasonAddresses from "../../contracts/common/addresses/appchain.json";
import localSeasonAddresses from "../../contracts/common/addresses/local.json";
import mainnetSeasonAddresses from "../../contracts/common/addresses/mainnet.json";
import sepoliaSeasonAddresses from "../../contracts/common/addresses/sepolia.json";
import appchainBlitzGameManifest from "../../contracts/game/manifest_appchain_blitz.json";
import appchainEternumGameManifest from "../../contracts/game/manifest_appchain_eternum.json";
import madaraGameManifest from "../../contracts/game/manifest_madara.json";

/**
 * Interface representing season contract addresses and resources
 * @interface SeasonAddresses
 */
export interface SeasonAddresses {
  "Collectibles: Realms: Loot Chest": string;
  "Collectibles: Realms: Cosmetic Items": string;
  /** New loot chest contract key used on some chains (mainnet). */
  lootChests?: string;
  /** New cosmetics contract key used on some chains (mainnet). */
  cosmetics?: string;
  "Collectibles: Timelock Maker": string;
  "Collectibles: Realms: Elite Invite": string;
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
  /** Address of the STRK token contract */
  strk: string;
  /** Map of resource name to [resourceId, contractAddress] */
  resources: {
    [key: string]: (string | number)[];
  };
  /** Address of the marketplace contract */
  marketplace: string;
  /** Address of the cosmetics claim contract */
  cosmeticsClaim: string;
  /** Address of the MMR token contract */
  mmrToken: string;
}

/** Address tables used by independent season-contract tooling. */
export type SeasonChain = GameChain | "local" | "mainnet" | "sepolia";
export type AppchainGameType = "blitz" | "eternum";

/**
 * Retrieves the season addresses for a specific chain
 * @param chain - The chain identifier
 * @returns The contract addresses for the specified chain
 * @throws Error if addresses cannot be loaded
 */
export function getSeasonAddresses(chain: SeasonChain): SeasonAddresses {
  try {
    switch (chain) {
      case "sepolia":
        return sepoliaSeasonAddresses;
      case "mainnet":
        return mainnetSeasonAddresses;
      case "local":
      case "madara":
        return localSeasonAddresses as any;
      case "appchain":
        return appchainSeasonAddresses as any;
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
export function getGameManifest(chain: GameChain, appchainGameType: AppchainGameType = "blitz"): GameManifest {
  try {
    switch (chain) {
      case "madara":
        return madaraGameManifest;
      case "appchain":
        return appchainGameType === "blitz" ? appchainBlitzGameManifest : appchainEternumGameManifest;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}
