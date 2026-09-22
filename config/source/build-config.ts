import { duelBaseConfig } from "./duel/base";
import { frontierBaseConfig } from "./frontier/base";
import type { Config } from "../../packages/types/src/types/common";
import type { GameChain } from "@realms-world/chain";
import { blitzBaseConfig } from "./blitz";
import {
  buildEnvironmentContextConfig,
  resolveEnvironmentContext,
  type EnvironmentContext,
} from "./common/environment";
import { mergeConfigPatches } from "./common/merge-config";
import type { BuildConfigOptions, GameType } from "./common/types";
import { resolveBlitzChainConfig } from "./blitz/chains";
import { eternumBaseConfig } from "./eternum/base";
import { resolveEternumChainConfig } from "./eternum/chains";

export type { BuildConfigOptions, GameType };

function resolveBaseGameConfig(gameType: GameType) {
  return { blitz: blitzBaseConfig, eternum: eternumBaseConfig, frontier: frontierBaseConfig, duel: duelBaseConfig }[
    gameType
  ];
}

const chainConfigByMode: Record<
  GameType,
  (chain: GameChain, context: EnvironmentContext) => ReturnType<typeof resolveBlitzChainConfig>
> = {
  frontier: () => ({}),
  blitz: resolveBlitzChainConfig,
  duel: resolveBlitzChainConfig,
  eternum: resolveEternumChainConfig,
};

export async function buildConfig(options: BuildConfigOptions): Promise<Config> {
  const environmentContext = resolveEnvironmentContext(options.chain);
  const baseConfig = mergeConfigPatches<Config>(
    resolveBaseGameConfig(options.gameType),
    buildEnvironmentContextConfig(environmentContext),
    chainConfigByMode[options.gameType](options.chain, environmentContext),
  );
  const durationSeconds =
    options.durationSeconds ?? (options.durationMinutes === undefined ? undefined : options.durationMinutes * 60);
  if (durationSeconds !== undefined) baseConfig.season.durationSeconds = durationSeconds;
  return baseConfig;
}
