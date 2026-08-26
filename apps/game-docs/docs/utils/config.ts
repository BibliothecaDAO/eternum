import { getConfigFromNetwork, type GameType } from "@config";
import { env } from "../../env";

const resolveConfigGameType = (explicitGameType?: GameType, envGameType?: GameType): GameType =>
  explicitGameType ?? envGameType ?? "blitz";

export const ETERNUM_CONFIG = (explicitGameType?: GameType) => {
  const config = getConfigFromNetwork(
    env.VITE_PUBLIC_CHAIN as Parameters<typeof getConfigFromNetwork>[0],
    resolveConfigGameType(explicitGameType, env.VITE_PUBLIC_FORCE_GAME_MODE_ID as GameType | undefined),
  );
  return config;
};
