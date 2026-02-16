import type { Config } from "@bibliothecadao/types";
import type { GameType } from "./environment";
export type { GameType };
import blitzLocalConfig from "../environments/data/blitz.local.json";
import blitzMainnetConfig from "../environments/data/blitz.mainnet.json";
import blitzSepoliaConfig from "../environments/data/blitz.sepolia.json";
import blitzSlotConfig from "../environments/data/blitz.slot.json";
import blitzSlottestConfig from "../environments/data/blitz.slottest.json";
import eternumLocalConfig from "../environments/data/eternum.local.json";
import eternumMainnetConfig from "../environments/data/eternum.mainnet.json";
import eternumSepoliaConfig from "../environments/data/eternum.sepolia.json";
import eternumSlotConfig from "../environments/data/eternum.slot.json";
import eternumSlottestConfig from "../environments/data/eternum.slottest.json";

/** Valid chain identifiers */
export type Chain = "sepolia" | "mainnet" | "slot" | "slottest" | "local";

const configs: Record<GameType, Record<Chain, any>> = {
  blitz: {
    local: blitzLocalConfig,
    mainnet: blitzMainnetConfig,
    sepolia: blitzSepoliaConfig,
    slot: blitzSlotConfig,
    slottest: blitzSlottestConfig,
  },
  eternum: {
    local: eternumLocalConfig,
    mainnet: eternumMainnetConfig,
    sepolia: eternumSepoliaConfig,
    slot: eternumSlotConfig,
    slottest: eternumSlottestConfig,
  },
};

export function getConfigFromNetwork(chain: Chain, gameType: GameType): Config {
  const gameConfigs = configs[gameType];
  if (!gameConfigs) {
    throw new Error(`Invalid game type: ${gameType}. Must be "blitz" or "eternum".`);
  }
  const config = gameConfigs[chain];
  if (!config) {
    throw new Error(`Invalid chain: ${chain}`);
  }
  return config.configuration as any;
}
