import { getSeasonAddresses } from "@contracts";
import { env } from "../../../../../env";

export type CosmeticsNetwork = "mainnet";

const addresses = getSeasonAddresses("mainnet");

const resolveLootChestAddress = (): string => addresses.lootChests || addresses["Collectibles: Realms: Loot Chest"];

const resolveCosmeticsAddress = (): string => addresses.cosmetics || addresses["Collectibles: Realms: Cosmetic Items"];

export const COSMETICS_NETWORK_CONFIG: Record<
  CosmeticsNetwork,
  {
    label: string;
    marketplaceUrl: string;
    cosmeticsAddress: string;
    lootChestsAddress: string;
    cosmeticsClaimAddress: string;
    cosmeticsCollectionId: number;
    lootChestCollectionId: number;
  }
> = {
  mainnet: {
    label: "Mainnet",
    marketplaceUrl: env.VITE_PUBLIC_MARKETPLACE_URL,
    cosmeticsAddress: resolveCosmeticsAddress(),
    lootChestsAddress: resolveLootChestAddress(),
    cosmeticsClaimAddress: addresses.cosmeticsClaim,
    cosmeticsCollectionId: 4,
    lootChestCollectionId: 3,
  },
};

export const DEFAULT_COSMETICS_NETWORK: CosmeticsNetwork = "mainnet";
