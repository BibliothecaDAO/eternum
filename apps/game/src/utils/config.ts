import { resolveGameModeFromBlitzFlag } from "@/config/game-modes/resolved-mode";

import { ContractComponents } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { type GameType, getConfigFromNetwork } from "@config";
import type { GameChain } from "@realms-world/chain";
import { env } from "./../../env";
import { worldConfigKey } from "@/dojo/game-scope";

type ConfigResolutionOptions = {
  chain?: GameChain;
  gameType?: GameType;
  components?: ContractComponents;
};

const resolveGameTypeFromComponents = (components: ContractComponents): GameType => {
  const worldConfig = getComponentValue(components.WorldConfig, worldConfigKey());
  return resolveGameModeFromBlitzFlag(worldConfig?.blitz_mode_on) === "blitz" ? "blitz" : "eternum";
};

const resolveGameType = (options?: ConfigResolutionOptions): GameType => {
  if (options?.gameType) {
    return options.gameType;
  }

  if (options?.components) {
    return resolveGameTypeFromComponents(options.components);
  }

  return "eternum";
};

export const ETERNUM_CONFIG = (options: ConfigResolutionOptions = {}) => {
  const chain = options.chain ?? env.VITE_PUBLIC_CHAIN;
  const gameType = resolveGameType(options);
  return getConfigFromNetwork(chain, gameType);
};
