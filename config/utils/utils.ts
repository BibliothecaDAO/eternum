import {
  applyBlitzBalanceProfile,
  BLITZ_OFFICIAL_DURATION_MINUTES,
  resolveBlitzBalanceProfileIdFromDurationMinutes,
  resolveBlitzBalanceProfileIdFromDurationSeconds,
  type BlitzBalanceProfileId,
} from "../source/blitz";
import type { GameType } from "../source/common/types";
import type { GameChain } from "@realms-world/chain";
export type { GameType };
import blitzAppchainConfig from "../generated/blitz.appchain.json";
import blitzMadaraConfig from "../generated/blitz.madara.json";
import eternumAppchainConfig from "../generated/eternum.appchain.json";

type NetworkConfigDocument = {
  configuration: any;
};

const configs: Record<GameType, Partial<Record<GameChain, NetworkConfigDocument>>> = {
  blitz: {
    madara: blitzMadaraConfig,
    appchain: blitzAppchainConfig,
  },
  eternum: {
    appchain: eternumAppchainConfig,
  },
};

function resolveConfigDocument(chain: GameChain, gameType: GameType): NetworkConfigDocument {
  const gameConfigs = configs[gameType];
  if (!gameConfigs) {
    throw new Error(`Invalid game type: ${gameType}. Must be "blitz" or "eternum".`);
  }

  const configDocument = gameConfigs[chain];
  if (!configDocument) {
    throw new Error(`Invalid chain: ${chain}`);
  }

  return configDocument;
}

export function getConfigFromNetwork(chain: GameChain, gameType: GameType) {
  return resolveConfigDocument(chain, gameType).configuration as any;
}

export function resolveBlitzConfigForDuration(chain: GameChain, durationMinutes: number | null | undefined) {
  const baseConfig = getConfigFromNetwork(chain, "blitz");
  const profileId = resolveBlitzBalanceProfileIdFromDurationMinutes(durationMinutes);

  if (!profileId) {
    return structuredClone(baseConfig);
  }

  return applyBlitzBalanceProfile(baseConfig, profileId);
}

export {
  applyBlitzBalanceProfile,
  BLITZ_OFFICIAL_DURATION_MINUTES,
  resolveBlitzBalanceProfileIdFromDurationMinutes,
  resolveBlitzBalanceProfileIdFromDurationSeconds,
};
export type { BlitzBalanceProfileId };
export {
  GAME_ENVIRONMENTS,
  getGameEnvironmentsForChain,
  isGameEnvironmentId,
  type GameEnvironment,
  type GameEnvironmentId,
} from "../shared/game-environments";
