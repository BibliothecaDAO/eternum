import { env } from "@/../env";
import { getSeasonAddresses, type SeasonChain } from "@contracts/utils";

export const getResourceAddresses = () => {
  const addresses = getSeasonAddresses(env.VITE_PUBLIC_CHAIN as SeasonChain).resources;
  return addresses;
};

export const getSeasonPassAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as SeasonChain).seasonPass;
};

export const getLordsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as SeasonChain).lords;
};
