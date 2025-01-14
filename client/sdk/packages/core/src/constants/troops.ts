import { ResourcesIds } from ".";

export const TROOPS_STAMINAS = {
  [ResourcesIds.Paladin]: 100,
  [ResourcesIds.Knight]: 80,
  [ResourcesIds.Crossbowman]: 80,
};

export type TroopFoodConsumption = {
  explore_wheat_burn_amount: number;
  explore_fish_burn_amount: number;
  travel_wheat_burn_amount: number;
  travel_fish_burn_amount: number;
};

export const TROOPS_FOOD_CONSUMPTION: Record<number, TroopFoodConsumption> = {
  [ResourcesIds.Paladin]: {
    explore_wheat_burn_amount: 0.01,
    explore_fish_burn_amount: 0.01,
    travel_wheat_burn_amount: 0.004,
    travel_fish_burn_amount: 0.004,
  },
  [ResourcesIds.Knight]: {
    explore_wheat_burn_amount: 0.01,
    explore_fish_burn_amount: 0.01,
    travel_wheat_burn_amount: 0.005,
    travel_fish_burn_amount: 0.005,
  },
  [ResourcesIds.Crossbowman]: {
    explore_wheat_burn_amount: 0.006,
    explore_fish_burn_amount: 0.005,
    travel_wheat_burn_amount: 0.003,
    travel_fish_burn_amount: 0.003,
  },
};
