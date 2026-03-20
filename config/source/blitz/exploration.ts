import type { ConfigPatch } from "../common/merge-config";

export const blitzExplorationConfig: ConfigPatch = {
  exploration: {
    reward: 750,
    shardsMinesFailProbability: 49_000,
    shardsMinesWinProbability: 1_000,
    agentFindProbability: 0,
    agentFindFailProbability: 100,
    campFindProbability: 1_500,
    campFindFailProbability: 48_500,
    holysiteFindProbability: 0,
    holysiteFindFailProbability: 1,
    bitcoinMineWinProbability: 0,
    bitcoinMineFailProbability: 1,
    hyperstructureWinProbAtCenter: 0,
    hyperstructureFailProbAtCenter: 1,
    hyperstructureFailProbIncreasePerHexDistance: 9_820,
    hyperstructureFailProbIncreasePerHyperstructureFound: 1,
    shardsMineInitialWheatBalance: 1000,
    shardsMineInitialFishBalance: 1000,
    questFindProbability: 1,
    questFindFailProbability: 99,
    relicDiscoveryIntervalSeconds: 5 * 60,
    relicHexDistanceFromCenter: 10,
    relicChestRelicsPerChest: 3,
  },
};
