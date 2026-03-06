import { Chain, getSeasonAddresses } from "@contracts";
import { env } from "../../../../env";

const getSeasonNetworkAddresses = () => getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain);

export const getResourceAddresses = () => {
  const addresses = getSeasonNetworkAddresses().resources;
  return addresses as {
    [key: string]: [number, string];
  };
};

export const getSeasonPassAddress = () => {
  return getSeasonNetworkAddresses().seasonPass;
};

export const getLordsAddress = () => {
  return getSeasonNetworkAddresses().lords;
};

export const getRealmsAddress = () => {
  return getSeasonNetworkAddresses().realms;
};

export const getMarketplaceAddress = () => {
  return getSeasonNetworkAddresses().marketplace;
};

export const getLootChestsAddress = () => {
  const addresses = getSeasonNetworkAddresses();
  return addresses.lootChests || addresses["Collectibles: Realms: Loot Chest"];
};

export const getCosmeticsAddress = () => {
  const addresses = getSeasonNetworkAddresses();
  return addresses.cosmetics || addresses["Collectibles: Realms: Cosmetic Items"];
};

export const getCosmeticsClaimAddress = () => {
  return getSeasonNetworkAddresses().cosmeticsClaim;
};
