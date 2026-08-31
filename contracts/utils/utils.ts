import type { GameChain } from "@realms-world/chain";
import appchainSeasonAddresses from "../../contracts/common/addresses/appchain.json";
import localSeasonAddresses from "../../contracts/common/addresses/local.json";
import madaraSeasonAddresses from "../../contracts/common/addresses/madara.json";
import mainnetSeasonAddresses from "../../contracts/common/addresses/mainnet.json";
import sepoliaSeasonAddresses from "../../contracts/common/addresses/sepolia.json";
import appchainBlitzGameManifest from "../../contracts/l3/game/manifest_appchain_blitz.json";
import appchainEternumGameManifest from "../../contracts/l3/game/manifest_appchain_eternum.json";

/**
 * Interface representing season contract addresses and resources
 * @interface SeasonAddresses
 */
export interface SeasonAddresses {
  "Collectibles: Realms: Loot Chest": string;
  "Collectibles: Realms: Cosmetic Items": string;
  /** Canonical loot chest contract key. */
  lootChests?: string;
  /** Canonical elite invite contract key. */
  eliteInvite?: string;
  /** Canonical cosmetics contract key. */
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
  /** Address whose balance funds factory game deployment. */
  factoryDeployer?: string;
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

export type AppchainGameType = "blitz" | "eternum";

/**
 * Retrieves the season addresses for a specific chain
 * @param chain - The chain identifier
 * @returns The contract addresses for the specified chain
 * @throws Error if addresses cannot be loaded
 */
export function getSeasonAddresses(chain: string): SeasonAddresses {
  try {
    let addresses: unknown;
    switch (chain) {
      case "sepolia":
        addresses = sepoliaSeasonAddresses;
        break;
      case "mainnet":
        addresses = mainnetSeasonAddresses;
        break;
      case "local":
        addresses = localSeasonAddresses;
        break;
      case "madara":
        addresses = madaraSeasonAddresses;
        break;
      case "appchain":
        addresses = appchainSeasonAddresses;
        break;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
    return requireAddressTable(chain, addresses);
  } catch (error) {
    throw new Error(`Failed to load season addresses for chain ${chain}: ${error}`);
  }
}

const REQUIRED_ADDRESS_KEYS: Record<string, readonly string[]> = {
  appchain: ["strk", "factoryDeployer"],
  local: ["strk"],
  madara: ["strk", "factoryDeployer"],
  mainnet: ["strk", "lords", "seasonPass", "villagePass", "realms"],
  sepolia: ["strk", "lords", "seasonPass", "villagePass", "realms"],
};
const KNOWN_ADDRESS_KEYS = new Set([
  "Collectibles: Realms: Loot Chest",
  "Collectibles: Realms: Cosmetic Items",
  "Collectibles: Timelock Maker",
  "Collectibles: Realms: Elite Invite",
  "collectiblesClassHash",
  "villagePass",
  "seasonPass",
  "realms",
  "lords",
  "strk",
  "factoryDeployer",
  "resources",
  "marketplace",
  "cosmeticsClaim",
  "mmrToken",
  "lootChests",
  "eliteInvite",
  "cosmetics",
]);

function requireAddressTable(chain: string, value: unknown): SeasonAddresses {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${chain} address table is not an object`);
  }
  const addresses = value as Record<string, unknown>;
  for (const key of REQUIRED_ADDRESS_KEYS[chain] ?? []) {
    if (typeof addresses[key] !== "string" || addresses[key] === "") {
      throw new Error(`${chain} address table is missing ${key}`);
    }
  }
  return new Proxy(addresses, {
    get(target, key) {
      if (typeof key === "string" && KNOWN_ADDRESS_KEYS.has(key) && !(key in target)) {
        throw new Error(`${chain} address table does not define ${key}`);
      }
      return Reflect.get(target, key);
    },
  }) as unknown as SeasonAddresses;
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
        return loadMadaraGameManifest();
      case "appchain":
        return appchainGameType === "blitz" ? appchainBlitzGameManifest : appchainEternumGameManifest;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}

function loadMadaraGameManifest(): GameManifest {
  try {
    const manifests = import.meta.glob<{ default: GameManifest }>("../l3/game/manifest_madara.json", { eager: true });
    const manifest = manifests["../l3/game/manifest_madara.json"]?.default;
    if (manifest) return manifest;
  } catch {
    // import.meta.glob is supplied by Vite; Bun uses the runtime path below.
  }

  const runtimeRequire = (import.meta as ImportMeta & { require?: (path: string) => unknown }).require;
  if (runtimeRequire) {
    return runtimeRequire("../l3/game/manifest_madara.json") as GameManifest;
  }
  throw new Error("contracts/l3/game/manifest_madara.json does not exist; deploy the Madara world first");
}
