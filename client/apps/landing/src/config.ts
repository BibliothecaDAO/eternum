import {
  getLordsAddress,
  getMarketplaceAddress,
  getRealmsAddress,
  getSeasonPassAddress,
} from "./components/ui/utils/addresses";

export const lordsAddress = getLordsAddress();
export const seasonPassAddress = getSeasonPassAddress();
export const realmsAddress = getRealmsAddress();
export const marketplaceAddress = getMarketplaceAddress();

// Collection IDs for different networks
const COLLECTION_IDS = {
  mainnet: {
    "season-passes": 1,
    realms: 2,
  },
  sepolia: {
    "season-passes": 3,
    realms: 4,
  },
} as const;

// Get the current network from environment or default to mainnet
const currentNetwork = import.meta.env.VITE_PUBLIC_CHAIN === "sepolia" ? "sepolia" : "mainnet";

export const marketplaceCollections = {
  "season-passes": {
    address: seasonPassAddress,
    id: COLLECTION_IDS[currentNetwork]["season-passes"],
    name: "Season 1 Pass",
  },
  realms: {
    address: realmsAddress,
    id: COLLECTION_IDS[currentNetwork].realms,
    name: "Realms",
  },
} as const;
