import { Chain, getConfigFromNetwork } from "@config";
import { env } from "./../../env";

export const ETERNUM_CONFIG = () => {
  const config = getConfigFromNetwork(env.VITE_PUBLIC_CHAIN! as Chain);
  return config;
};
