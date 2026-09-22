import localSeasonAddresses from "../../contracts/common/addresses/local.json";
import madaraSeasonAddresses from "../../contracts/common/addresses/madara.json";
import mainnetSeasonAddresses from "../../contracts/common/addresses/mainnet.json";
import sepoliaSeasonAddresses from "../../contracts/common/addresses/sepolia.json";

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
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
    return requireAddressTable(chain, addresses);
  } catch (error) {
    throw new Error(`Failed to load season addresses for chain ${chain}: ${error}`);
  }
}

const REQUIRED_ADDRESS_KEYS: Record<string, readonly string[]> = {
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
