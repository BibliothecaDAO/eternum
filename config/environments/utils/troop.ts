import { ResourcesIds, type TroopFoodConsumption } from "@bibliothecadao/eternum";

// Food consumption rates (wheat/fish) per troop unit, scaled by resource precision
// Example: explore_wheat_burn_amount of 10 means 10 * RESOURCE_PRECISION wheat consumed per troop during exploration
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

export const TROOP_DAMAGE_RAID_PERCENT_NUM = 1_000; //10%


export const TROOP_BASE_DAMAGE = 1844674407370955161600n; // 100
export const TROOP_T2_DAMAGE_MULTIPLIER = 46116860184273879040n; // 2.5
export const TROOP_T3_DAMAGE_MULTIPLIER = 129127208515966861312n; // 7
export const TROOP_DAMAGE_BIOME_BONUS_NUM = 3_000; // 3_000/10_000 = 30%
export const TROOP_DAMAGE_SCALING_FACTOR = 64563604257983430656n; // 3.5
export const TROOP_DAMAGE_BETA_SMALL = 4611686018427387904n; // 0.25
export const TROOP_DAMAGE_BETA_LARGE = 2213609288845146193n; // 0.12
export const TROOP_DAMAGE_C0 = 100_000n * BigInt(2) ** BigInt(64);
export const TROOP_DAMAGE_DELTA = 50_000n * BigInt(2) ** BigInt(64);

// Stamina config
export const TROOP_STAMINA_INITIAL = 20;
export const TROOP_STAMINA_GAIN_PER_TICK = 20;
export const TROOP_STAMINA_BIOME_BONUS_VALUE = 10; // give 1 tick worth of stamina

export const TROOP_STAMINA_MAX = {
  [ResourcesIds.Knight]: 120,
  [ResourcesIds.Crossbowman]: 120,
  [ResourcesIds.Paladin]: 140,
};

// Combat stamina requirements
export const TROOP_STAMINA_ATTACK_REQ = 30;
export const TROOP_STAMINA_ATTACK_MAX = 60;
// Troop travel
export const TROOP_TRAVEL_WHEAT_COST = 3;
export const TROOP_TRAVEL_FISH_COST = 3;
export const TROOP_TRAVEL_STAMINA_COST = 20;

// Troop exploration
export const TROOP_EXPLORE_WHEAT_COST = 6;
export const TROOP_EXPLORE_FISH_COST = 6;
export const TROOP_EXPLORE_STAMINA_COST = 30;

// Troop limit config
export const TROOP_EXPLORER_MAX_PARTY_COUNT = 10;
export const TROOP_EXPLORER_GUARD_MAX_TROOP_COUNT = 500_000;
export const TROOP_GUARD_RESURRECTION_DELAY = 60 * 60 * 24; // 1 day
export const TROOP_MERCENARIES_TROOP_LOWER_BOUND = 3_000;
export const TROOP_MERCENARIES_TROOP_UPPER_BOUND = 6_000;
export const TROOP_AGENTS_TROOP_LOWER_BOUND = 400_000;
export const TROOP_AGENTS_TROOP_UPPER_BOUND = 500_000;
