import { Chain, GameType, getConfigFromNetwork } from "@config";
import { env } from "../../env";

export const ETERNUM_CONFIG = () => {
  const config = getConfigFromNetwork(env.VITE_PUBLIC_CHAIN! as Chain, env.VITE_PUBLIC_FORCE_GAME_MODE_ID! as GameType);
  return config;
};
