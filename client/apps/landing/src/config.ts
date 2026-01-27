import {
  getCosmeticsAddress,
  getCosmeticsClaimAddress,
  getLootChestsAddress,
  getLordsAddress,
  getMarketplaceAddress,
  getRealmsAddress,
  getSeasonPassAddress,
} from "./components/ui/utils/addresses";
import { trimAddress } from "./lib/utils";

export const lordsAddress = getLordsAddress();
export const seasonPassAddress = getSeasonPassAddress();
export const realmsAddress = getRealmsAddress();
export const marketplaceAddress = getMarketplaceAddress();
export const lootChestsAddress = getLootChestsAddress();
const cosmeticsAddress = getCosmeticsAddress();
export const cosmeticsClaimAddress = getCosmeticsClaimAddress();

// Collection IDs for different networks
const COLLECTION_IDS = {
  mainnet: {
    realms: 2,
    "loot-chests": 3,
    cosmetics: 4,
    "golden-tokens": 5,
    beasts: 7,
    adventurers: 8,
  },
  sepolia: {
    realms: 4,
    "loot-chests": 5,
    cosmetics: 6, // TODO: Replace with actual collection ID
    "golden-tokens": null,
    beasts: null,
    adventurers: null,
  },
} as const;

// Get the current network from environment or default to mainnet
const currentNetwork = import.meta.env.VITE_PUBLIC_CHAIN === "sepolia" ? "sepolia" : "mainnet";

export const marketplaceCollections = {
  realms: {
    address: realmsAddress,
    id: COLLECTION_IDS[currentNetwork].realms,
    name: "Realms",
    image: "/collections/realms.png",
    defaultTraitFilters: {},
  },
  "loot-chests": {
    address: lootChestsAddress,
    id: COLLECTION_IDS[currentNetwork]["loot-chests"],
    name: "Loot Chest",
    image: "/collections/loot-chests.png",
    defaultTraitFilters: {},
  },
  cosmetics: {
    address: cosmeticsAddress,
    id: COLLECTION_IDS[currentNetwork].cosmetics,
    name: "Cosmetics",
    image: "/collections/cosmetics.png", // TODO: Replace with actual cosmetics image
    defaultTraitFilters: {},
  },
  "golden-tokens": {
    address: currentNetwork === "mainnet" ? "0x27838dea749f41c6f8a44fcfa791788e6101080c1b3cd646a361f653ad10e2d" : "", // Mainnet support only
    id: COLLECTION_IDS[currentNetwork]["golden-tokens"],
    name: "Golden Tokens",
    image: "/collections/golden-tokens.svg",
    defaultTraitFilters: {},
  },
  beasts: {
    address: currentNetwork === "mainnet" ? "0x46da8955829adf2bda310099a0063451923f02e648cf25a1203aac6335cf0e4" : "",
    id: COLLECTION_IDS[currentNetwork].beasts,
    name: "Beasts",
    image: "/collections/beasts.svg",
    defaultTraitFilters: {},
  },
  adventurers: {
    address: currentNetwork === "mainnet" ? "0x36017e69d21d6d8c13e266eabb73ef1f1d02722d86bdcabe5f168f8e549d3cd" : "",
    id: COLLECTION_IDS[currentNetwork].adventurers,
    name: "Adventurers",
    image: "/collections/adventurers.png",
    defaultTraitFilters: {
      "Minted By": ["0xa67ef20b61a9846e1c82b411175e6ab167ea9f8632bd6c2091823c3629ec42"],
    },
  },
} as const;

export function getCollectionByAddress(
  address: string,
): (typeof marketplaceCollections)[keyof typeof marketplaceCollections] | null {
  const collection = Object.entries(marketplaceCollections).find(([_, data]) => {
    return trimAddress(data.address)?.toLowerCase() === trimAddress(address)?.toLowerCase();
  });
  return collection ? collection[1] : null; // Default to season passes if not found
}
