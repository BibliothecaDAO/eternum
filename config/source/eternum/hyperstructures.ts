import { ResourcesIds } from "../../../packages/types/src/constants";
import type { ConfigPatch } from "../common/merge-config";
import { VICTORY_POINTS_MULTIPLIER } from "./points";

export const eternumHyperstructureConfig: ConfigPatch = {
  hyperstructures: {
    hyperstructureInitializationShardsCost: {
      resource: ResourcesIds.AncientFragment,
      amount: 20 * VICTORY_POINTS_MULTIPLIER,
    },
    hyperstructureConstructionCost: [
      {
        resource_type: ResourcesIds.Wood,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 250 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 400 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Stone,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 250 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 400 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Coal,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 250 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 400 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Copper,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 175 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 250 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Obsidian,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 175 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 250 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Silver,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 175 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 250 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Ironwood,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 75 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 125 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.ColdIron,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 75 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 125 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Gold,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 75 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 125 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Hartwood,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 45 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 60 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Diamonds,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 45 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 60 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Sapphire,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 45 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 60 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Ruby,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 45 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 60 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.DeepCrystal,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 35 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 45 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Ignium,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 35 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 45 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.EtherealSilica,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 35 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 45 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.TrueIce,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 30 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 35 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.TwilightQuartz,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 30 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 35 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.AlchemicalSilver,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 30 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 35 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Adamantine,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 25 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 30 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Mithral,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 25 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 30 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Dragonhide,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 25 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 30 * VICTORY_POINTS_MULTIPLIER,
      },
      {
        resource_type: ResourcesIds.Labor,
        resource_completion_points: 21_732 * VICTORY_POINTS_MULTIPLIER,
        min_amount: 50 * VICTORY_POINTS_MULTIPLIER,
        max_amount: 50 * VICTORY_POINTS_MULTIPLIER,
      },
    ],
  },
};
