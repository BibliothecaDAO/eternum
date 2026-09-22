import duelMadaraConfig from "../generated/duel.madara.json";
import frontierMadaraConfig from "../generated/frontier.madara.json";

import type { GameType } from "../source/common/types";
import type { ConfigurationNetwork } from "../shared/game-environments";
export type { GameType };
import blitzMadaraConfig from "../generated/blitz.madara.json";
import eternumMadaraConfig from "../generated/eternum.madara.json";

type NetworkConfigDocument = {
  configuration: any;
};

const configs: Record<GameType, Partial<Record<ConfigurationNetwork, NetworkConfigDocument>>> = {
  duel: { madara: duelMadaraConfig },
  frontier: { madara: frontierMadaraConfig },
  blitz: {
    madara: blitzMadaraConfig,
  },
  eternum: {
    madara: eternumMadaraConfig,
  },
};

function resolveConfigDocument(chain: ConfigurationNetwork, gameType: GameType): NetworkConfigDocument {
  const gameConfigs = configs[gameType];
  if (!gameConfigs) {
    throw new Error(`Invalid game type: ${gameType}. Must be "blitz", "eternum", "frontier" or "duel".`);
  }

  const configDocument = gameConfigs[chain];
  if (!configDocument) {
    throw new Error(`Invalid chain: ${chain}`);
  }

  return configDocument;
}

export function getConfigFromNetwork(chain: ConfigurationNetwork, gameType: GameType) {
  return resolveConfigDocument(chain, gameType).configuration as any;
}

export {
  GAME_ENVIRONMENTS,
  isGameEnvironmentId,
  type GameEnvironment,
  type GameEnvironmentId,
} from "../shared/game-environments";
