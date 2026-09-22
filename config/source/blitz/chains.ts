import type { ConfigurationNetwork } from "../../shared/game-environments";
import type { ConfigPatch } from "../common/merge-config";
import { mergeConfigPatches } from "../common/merge-config";
import { madaraBlitzConfig } from "./madara";

const STANDARD_BLITZ_CHAIN_CONFIG: ConfigPatch = {
  season: {
    startSettlingAfterSeconds: 59,
    startMainAfterSeconds: 60,
  },
  battle: {
    regularImmunityTicks: 0,
    villageImmunityTicks: 0,
    delaySeconds: 0,
  },
};

export function resolveBlitzChainConfig(chain: ConfigurationNetwork): ConfigPatch {
  if (chain !== "madara") throw new Error(`Unsupported configuration profile ${chain}`);
  return mergeConfigPatches(STANDARD_BLITZ_CHAIN_CONFIG, madaraBlitzConfig);
}
