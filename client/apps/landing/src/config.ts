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
    "season-passes": 1,
    realms: 2,
    "loot-chests": 3,
    cosmetics: 4, // TODO: Replace with actual collection ID
    "golden-tokens": 5,
  },
  sepolia: {
    "season-passes": 3,
    realms: 4,
    "loot-chests": 5,
    cosmetics: 6, // TODO: Replace with actual collection ID
    "golden-tokens": null,
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
  },
  "season-passes": {
    address: seasonPassAddress,
    id: COLLECTION_IDS[currentNetwork]["season-passes"],
    name: "Season 1 Pass",
    image: "/collections/season-passes.png",
  },
  "loot-chests": {
    address: lootChestsAddress,
    id: COLLECTION_IDS[currentNetwork]["loot-chests"],
    name: "Loot Chest",
    image: "/collections/loot-chests.png",
  },
  cosmetics: {
    address: cosmeticsAddress,
    id: COLLECTION_IDS[currentNetwork].cosmetics,
    name: "Cosmetics",
    image: "/collections/cosmetics.png", // TODO: Replace with actual cosmetics image
  },
  "golden-tokens": {
    address: "0x027838dea749f41c6f8a44fcfa791788e6101080c1b3cd646a361f653ad10e2d", // Mainnet support only
    id: COLLECTION_IDS[currentNetwork]["golden-tokens"],
    name: "Golden Tokens",
    image: "/collections/golden-tokens.svg",
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
