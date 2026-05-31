import { Chain, getSeasonAddresses } from "@contracts";
import { resolveRuntimeChain } from "@/runtime/world";
import { env } from "../../env";

const resolveAddressChain = (chain?: Chain): Chain => chain ?? resolveRuntimeChain(env.VITE_PUBLIC_CHAIN as Chain);

const getResourceAddresses = (chain?: Chain) => {
  const addresses = getSeasonAddresses(resolveAddressChain(chain)).resources;
  return addresses;
};

export const getSeasonPassAddress = (chain?: Chain) => {
  return getSeasonAddresses(resolveAddressChain(chain)).seasonPass;
};

const getRealmsAddress = (chain?: Chain) => {
  return getSeasonAddresses(resolveAddressChain(chain)).realms;
};

const getLordsAddress = (chain?: Chain) => {
  const resolvedChain = resolveAddressChain(chain);
  if (resolvedChain == "mainnet") {
    return getSeasonAddresses(resolvedChain).lords;
  }
  return getSeasonAddresses(resolvedChain).resources.LORDS[1];
};

const getClientFeeRecipient = () => {
  return env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT;
};

export const getVillagePassAddress = (chain?: Chain) => {
  return getSeasonAddresses(resolveAddressChain(chain)).villagePass;
};
