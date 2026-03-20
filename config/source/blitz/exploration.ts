import { ResourcesIds } from "../../../packages/types/src/constants";
import type { ConfigPatch } from "../common/merge-config";

const baseBlitzExplorationRewards = [
  { rewardId: ResourcesIds.Essence, amount: 100, probabilityBps: 3_000 },
  { rewardId: ResourcesIds.Essence, amount: 250, probabilityBps: 2_000 },
  { rewardId: ResourcesIds.Essence, amount: 500, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, amount: 250, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, amount: 500, probabilityBps: 800 },
  { rewardId: ResourcesIds.Donkey, amount: 100, probabilityBps: 600 },
  { rewardId: ResourcesIds.Knight, amount: 1_000, probabilityBps: 200 },
  { rewardId: ResourcesIds.Crossbowman, amount: 1_000, probabilityBps: 200 },
  { rewardId: ResourcesIds.Paladin, amount: 1_000, probabilityBps: 200 },
] as const;

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
  blitz: {
    exploration: {
      rewardProfileId: "official-90",
      rewards: [...baseBlitzExplorationRewards],
    },
  },
};
