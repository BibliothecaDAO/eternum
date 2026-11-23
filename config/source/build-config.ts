import { frontierBaseConfig } from "./frontier/base";
import type { Config } from "../../packages/types/src/types/common";
import type { ConfigurationNetwork } from "../shared/game-environments";
import { blitzBaseConfig } from "./blitz";
import {
  buildEnvironmentContextConfig,
  resolveEnvironmentContext,
  type EnvironmentContext,
} from "./common/environment";
import { mergeConfigPatches } from "./common/merge-config";
import type { BuildConfigOptions, GameType } from "./common/types";
import { resolveBlitzChainConfig } from "./blitz/chains";

export type { BuildConfigOptions, GameType };

function resolveBaseGameConfig(gameType: GameType) {
  return { blitz: blitzBaseConfig, frontier: frontierBaseConfig }[gameType];
}

const chainConfigByMode: Record<
  GameType,
  (chain: ConfigurationNetwork, context: EnvironmentContext) => ReturnType<typeof resolveBlitzChainConfig>
> = {
  frontier: () => ({}),
  blitz: resolveBlitzChainConfig,
};

export async function buildConfig(options: BuildConfigOptions): Promise<Config> {
  const environmentContext = resolveEnvironmentContext(options.chain);
  const baseConfig = mergeConfigPatches<Config>(
    resolveBaseGameConfig(options.gameType),
    buildEnvironmentContextConfig(environmentContext),
    chainConfigByMode[options.gameType](options.chain, environmentContext),
  );
  const durationSeconds =
    options.durationSeconds ?? (options.durationMinutes == null ? undefined : options.durationMinutes * 60);
  if (durationSeconds !== undefined) baseConfig.season.durationSeconds = durationSeconds;
  return baseConfig;
}
