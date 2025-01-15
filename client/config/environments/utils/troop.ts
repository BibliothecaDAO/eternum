import { ResourcesIds, TroopFoodConsumption } from "@bibliothecadao/eternum";

export const TROOPS_STAMINAS = {
    [ResourcesIds.Paladin]: 100,
    [ResourcesIds.Knight]: 80,
    [ResourcesIds.Crossbowman]: 80,
  };
  

  
  export const TROOPS_FOOD_CONSUMPTION: Record<number, TroopFoodConsumption> = {
    [ResourcesIds.Paladin]: {
      explore_wheat_burn_amount: 10,
      explore_fish_burn_amount: 10,
      travel_wheat_burn_amount: 4,
      travel_fish_burn_amount: 4,
    },
    [ResourcesIds.Knight]: {
      explore_wheat_burn_amount: 10,
      explore_fish_burn_amount: 10,
      travel_wheat_burn_amount: 5,
      travel_fish_burn_amount: 5,
    },
    [ResourcesIds.Crossbowman]: {
      explore_wheat_burn_amount: 6,
      explore_fish_burn_amount: 6,
      travel_wheat_burn_amount: 3,
      travel_fish_burn_amount: 3,
    },
  };
  