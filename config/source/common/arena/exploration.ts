import type { ConfigPatch } from "../merge-config";

export const arenaExplorationConfig: ConfigPatch = {
  exploration: {
    shardsMinesFailProbability: 49_000,
    shardsMinesWinProbability: 1_000,
    campFindProbability: 1_500,
    campFindFailProbability: 48_500,
    bitcoinMineWinProbability: 0,
    bitcoinMineFailProbability: 1,
    hyperstructureWinProbAtCenter: 0,
    hyperstructureFailProbAtCenter: 1,
    hyperstructureFailProbIncreasePerHexDistance: 9_820,
    hyperstructureFailProbIncreasePerHyperstructureFound: 1,
    shardsMineInitialWheatBalance: 1000,
    shardsMineInitialFishBalance: 1000,
    relicDiscoveryIntervalSeconds: 5 * 60,
    relicHexDistanceFromCenter: 10,
  },
};
