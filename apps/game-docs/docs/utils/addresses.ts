import { env } from "@/../env";
import { Chain, getSeasonAddresses } from "@contracts/utils";

export const getResourceAddresses = () => {
  const addresses = getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).resources;
  return addresses;
};

export const getSeasonPassAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).seasonPass;
};

export const getLordsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).lords;
};
