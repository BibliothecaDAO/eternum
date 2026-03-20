import type { ConfigPatch } from "../common/merge-config";

export const eternumExplorationConfig: ConfigPatch = {
  exploration: {
    reward: 750,
    shardsMinesFailProbability: 49_000,
    shardsMinesWinProbability: 1_000,
    agentFindProbability: 0,
    agentFindFailProbability: 100,
    campFindProbability: 1_500,
    campFindFailProbability: 48_500,
    holysiteFindProbability: 500,
    holysiteFindFailProbability: 49_500,
    bitcoinMineWinProbability: 200,
    bitcoinMineFailProbability: 9800,
    hyperstructureWinProbAtCenter: 2_000,
    hyperstructureFailProbAtCenter: 98_000,
    hyperstructureFailProbIncreasePerHexDistance: 9_820,
    hyperstructureFailProbIncreasePerHyperstructureFound: 1,
    shardsMineInitialWheatBalance: 1000,
    shardsMineInitialFishBalance: 1000,
    questFindProbability: 1,
    questFindFailProbability: 99,
    relicDiscoveryIntervalSeconds: 0,
    relicHexDistanceFromCenter: 0,
    relicChestRelicsPerChest: 0,
  },
};
