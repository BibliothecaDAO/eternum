import { ResourcesIds } from ".";

export const TROOPS_STAMINAS = {
  [ResourcesIds.Paladin]: 100,
  [ResourcesIds.Knight]: 80,
  [ResourcesIds.Crossbowman]: 80,
};

export const TROOPS_FOOD_CONSUMPTION = {
  [ResourcesIds.Paladin]: {
    // food burn amount per unit during exploration
    explore_wheat_burn_amount: 0.006,
    explore_fish_burn_amount: 0.006,
    // food burn amount per unit during travel
    travel_wheat_burn_amount: 0.002,
    travel_fish_burn_amount: 0.002,
  },
  [ResourcesIds.Knight]: {
    explore_wheat_burn_amount: 0.006,
    explore_fish_burn_amount: 0.006,
    travel_wheat_burn_amount: 0.002,
    travel_fish_burn_amount: 0.002,
  },
  [ResourcesIds.Crossbowman]: {
    explore_wheat_burn_amount: 0.003,
    explore_fish_burn_amount: 0.003,
    travel_wheat_burn_amount: 0.001,
    travel_fish_burn_amount: 0.001,
  },
};
