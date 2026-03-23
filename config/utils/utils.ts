import {
  applyBlitzBalanceProfile,
  BLITZ_OFFICIAL_DURATION_MINUTES,
  resolveBlitzBalanceProfileIdFromDurationMinutes,
  resolveBlitzBalanceProfileIdFromDurationSeconds,
  type BlitzBalanceProfileId,
} from "../source/blitz";
import type { Chain, GameType } from "../source/common/types";
export type { Chain, GameType };
import blitzLocalConfig from "../generated/blitz.local.json";
import blitzMainnetConfig from "../generated/blitz.mainnet.json";
import blitzSepoliaConfig from "../generated/blitz.sepolia.json";
import blitzSlotConfig from "../generated/blitz.slot.json";
import blitzSlottestConfig from "../generated/blitz.slottest.json";
import eternumLocalConfig from "../generated/eternum.local.json";
import eternumMainnetConfig from "../generated/eternum.mainnet.json";
import eternumSepoliaConfig from "../generated/eternum.sepolia.json";
import eternumSlotConfig from "../generated/eternum.slot.json";
import eternumSlottestConfig from "../generated/eternum.slottest.json";

type NetworkConfigDocument = {
  configuration: any;
};

const configs: Record<GameType, Record<Chain, NetworkConfigDocument>> = {
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

function resolveConfigDocument(chain: Chain, gameType: GameType): NetworkConfigDocument {
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

export function getConfigFromNetwork(chain: Chain, gameType: GameType) {
  return resolveConfigDocument(chain, gameType).configuration as any;
}

export function resolveBlitzConfigForDuration(chain: Chain, durationMinutes: number | null | undefined) {
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
