import { Chain, getSeasonAddresses } from "@contracts";
import { env } from "../../../../env";

export const getResourceAddresses = () => {
  const addresses = getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).resources;
  return addresses as {
    [key: string]: [number, string];
  };
};

export const getSeasonPassAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).seasonPass;
};

export const getLordsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).lords;
};

export const getRealmsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).realms;
};

export const getMarketplaceAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).marketplace;
};

export const getLootChestsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).lootChests;
};

export const getCosmeticsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).cosmetics;
};

export const getCosmeticsClaimAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).cosmeticsClaim;
};
