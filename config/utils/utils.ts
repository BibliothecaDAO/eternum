import duelMadaraConfig from "../generated/duel.madara.json";
import duelAppchainConfig from "../generated/duel.appchain.json";
import frontierMadaraConfig from "../generated/frontier.madara.json";

import type { GameType } from "../source/common/types";
import type { GameChain } from "@realms-world/chain";
export type { GameType };
import blitzAppchainConfig from "../generated/blitz.appchain.json";
import blitzMadaraConfig from "../generated/blitz.madara.json";
import eternumAppchainConfig from "../generated/eternum.appchain.json";
import eternumMadaraConfig from "../generated/eternum.madara.json";

type NetworkConfigDocument = {
  configuration: any;
};

const configs: Record<GameType, Partial<Record<GameChain, NetworkConfigDocument>>> = {
  duel: { madara: duelMadaraConfig, appchain: duelAppchainConfig },
  frontier: { madara: frontierMadaraConfig },
  blitz: {
    madara: blitzMadaraConfig,
    appchain: blitzAppchainConfig,
  },
  eternum: {
    madara: eternumMadaraConfig,
    appchain: eternumAppchainConfig,
  },
};

function resolveConfigDocument(chain: GameChain, gameType: GameType): NetworkConfigDocument {
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

export function getConfigFromNetwork(chain: GameChain, gameType: GameType) {
  return resolveConfigDocument(chain, gameType).configuration as any;
}

export {
  GAME_ENVIRONMENTS,
  getGameEnvironmentsForChain,
  isGameEnvironmentId,
  type GameEnvironment,
  type GameEnvironmentId,
} from "../shared/game-environments";
