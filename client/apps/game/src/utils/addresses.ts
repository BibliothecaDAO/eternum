import { Chain, getSeasonAddresses } from "@contracts";
import { env } from "../../env";

export const getResourceAddresses = () => {
  const addresses = getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).resources;
  return addresses;
};

export const getSeasonPassAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).seasonPass;
};

export const getRealmsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).realms;
};

export const getLordsAddress = () => {
  if ((env.VITE_PUBLIC_CHAIN as Chain) == "mainnet") {
    return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).lords;
  }
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).resources.LORDS[1];
};

export const getClientFeeRecipient = () => {
  return env.VITE_PUBLIC_FEE_TOKEN_ADDRESS;
};

export const getVillagePassAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).villagePass;
};
