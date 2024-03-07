// production per hour
const PRODUCTION_PER_HOUR = 10.5;

// Number of days of wood production for levelling up your realm
const NUMBER_OF_DAYS_OF_WOOD_PRODUCTION = 0.5;

// Food coefficient compared to wood production (% that should go to levelling up compared to other activities)
const FOOD_COEFFICIENT = 0.5;

// coefficient of initial amount of food to be minted when settling compared to the 1st levelling up cost
const INITIAL_FOOD_COEFFICIENT = 1.1;

// maximum % of your realms that could level up to level 4 without any interaction with other players
const MAXIMUM_REALMS_LEVEL = 2;

// Minimum number of players that need to collaborate to make hyperstructure levelling interesting
const MINIMUM_NUMBER_OF_PLAYERS = 5;

// number of realms per player
const NUMBER_OF_REALMS_PER_PLAYER = 5;

const AVERAGE_DAILY_AMOUNT_OF_WHEAT_PRODUCTION = 7560;
const AVERAGE_DAILY_AMOUNT_OF_FISH_PRODUCTION = 2520;

const RESOURCE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
];

// weights of each resource
const RESOURCE_WEIGHTS = [
  ["WOOD", 0.2018109],
  ["STONE", 0.1585915],
  ["COAL", 0.1542455],
  ["COPPER", 0.1063581],
  ["OBSIDIAN", 0.0891751],
  ["SILVER", 0.0700604],
  ["IRONWOOD", 0.0474447],
  ["COLD_IRON", 0.0385111],
  ["GOLD", 0.0367807],
  ["HARTWOOD", 0.0239034],
  ["DIAMONDS", 0.0120724],
  ["SAPPHIRE", 0.0099396],
  ["RUBY", 0.0096177],
  ["DEEP_CRYSTAL", 0.0096177],
  ["IGNIUM", 0.0069215],
  ["ETHEREAL_SILICA", 0.0065191],
  ["TRUE_ICE", 0.0055936],
  ["TWILIGHT_QUARTZ", 0.0044668],
  ["ALCHEMICAL_SILVER", 0.0037425],
  ["ADAMANTINE", 0.0022133],
  ["MITHRAL", 0.0014889],
  ["DRAGONHIDE", 0.0009256],
];

const RESOURCE_TIER_1 = [1, 2, 3, 4, 5, 6, 7];
const RESOURCE_TIER_2 = [8, 9, 10, 11, 12, 13, 14, 15];
const RESOURCE_TIER_3 = [16, 17, 18, 19, 20, 21, 22];

// buildings/guild
const RESOURCE_CATEGORY_1 = [1, 2, 3, 7, 10, 17];
const RESOURCE_CATEGORY_2 = [4, 6, 8, 9, 19, 20];
const RESOURCE_CATEGORY_3 = [11, 12, 13, 14, 18];
const RESOURCE_CATEGORY_4 = [5, 15, 16, 21, 22];

module.exports = {
  PRODUCTION_PER_HOUR,
  INITIAL_FOOD_COEFFICIENT,
  AVERAGE_DAILY_AMOUNT_OF_WHEAT_PRODUCTION,
  AVERAGE_DAILY_AMOUNT_OF_FISH_PRODUCTION,
  NUMBER_OF_DAYS_OF_WOOD_PRODUCTION,
  FOOD_COEFFICIENT,
  MAXIMUM_REALMS_LEVEL,
  MINIMUM_NUMBER_OF_PLAYERS,
  NUMBER_OF_REALMS_PER_PLAYER,
  RESOURCE_WEIGHTS,
  RESOURCE_TIER_1,
  RESOURCE_TIER_2,
  RESOURCE_TIER_3,
  RESOURCE_CATEGORY_1,
  RESOURCE_CATEGORY_2,
  RESOURCE_CATEGORY_3,
  RESOURCE_CATEGORY_4,
  RESOURCE_IDS,
};
