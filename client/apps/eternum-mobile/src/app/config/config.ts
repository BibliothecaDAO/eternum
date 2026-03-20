import { Chain, GameType, getConfigFromNetwork } from "@config";
import { env } from "../../../env";

const resolveConfigGameType = (explicitGameType?: GameType, envGameType?: GameType): GameType =>
  explicitGameType ?? envGameType ?? "blitz";

export const ETERNUM_CONFIG = (explicitGameType?: GameType) => {
  const config = getConfigFromNetwork(
    env.VITE_PUBLIC_CHAIN! as Chain,
    resolveConfigGameType(explicitGameType, env.VITE_PUBLIC_FORCE_GAME_MODE_ID as GameType | undefined),
  );
  return config;
};
