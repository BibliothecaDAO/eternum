import { Chain, getSeasonAddresses } from "@contracts";
import { env } from "../../env";

export const getResourceAddresses = async () => {
  const addresses = getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).resources;
  return addresses;
};

export const getSeasonPassAddress = async () => {
  return (await getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain)).seasonPass;
};

export const getLordsAddress = async () => {
  return (await getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain)).lords;
};

export const getRealmsAddress = async () => {
  return (await getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain)).realms;
};
