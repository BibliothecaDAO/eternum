import type { Config } from "../../packages/types/src/types/common";
import {
  applyBlitzBalanceProfile,
  blitzBaseConfig,
  resolveBlitzBalanceProfileIdFromDurationMinutes,
  resolveBlitzBalanceProfileIdFromDurationSeconds,
} from "./blitz";
import {
  buildEnvironmentContextConfig,
  resolveEnvironmentContext,
  type EnvironmentContext,
} from "./common/environment";
import { mergeConfigPatches } from "./common/merge-config";
import type { BuildConfigOptions, Chain, GameType } from "./common/types";
import { resolveBlitzChainConfig } from "./blitz/chains";
import { eternumBaseConfig } from "./eternum/base";
import { resolveEternumChainConfig } from "./eternum/chains";

export type { BuildConfigOptions, Chain, GameType };

function resolveBaseGameConfig(gameType: GameType) {
  return gameType === "blitz" ? blitzBaseConfig : eternumBaseConfig;
}

function resolveGameChainConfig(gameType: GameType, chain: Chain, context: EnvironmentContext) {
  return gameType === "blitz" ? resolveBlitzChainConfig(chain, context) : resolveEternumChainConfig(chain, context);
}

function resolveOptionalBlitzBalanceProfileId(options: BuildConfigOptions) {
  if (options.gameType !== "blitz") {
    return null;
  }

  return (
    resolveBlitzBalanceProfileIdFromDurationMinutes(options.durationMinutes) ??
    resolveBlitzBalanceProfileIdFromDurationSeconds(options.durationSeconds)
  );
}

export async function buildConfig(options: BuildConfigOptions): Promise<Config> {
  const environmentContext = await resolveEnvironmentContext(options.chain);
  const baseConfig = mergeConfigPatches<Config>(
    resolveBaseGameConfig(options.gameType),
    buildEnvironmentContextConfig(environmentContext),
    resolveGameChainConfig(options.gameType, options.chain, environmentContext),
  );
  const profileId = resolveOptionalBlitzBalanceProfileId(options);

  if (!profileId) {
    return baseConfig;
  }

  return applyBlitzBalanceProfile(baseConfig, profileId);
}
