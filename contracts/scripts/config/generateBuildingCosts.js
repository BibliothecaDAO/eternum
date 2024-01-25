const {
  FOOD_COEFFICIENT,
  PRODUCTION_PER_HOUR,
  AVERAGE_DAILY_AMOUNT_OF_WHEAT_PRODUCTION,
  AVERAGE_DAILY_AMOUNT_OF_FISH_PRODUCTION,
  NUMBER_OF_DAYS_OF_WOOD_PRODUCTION,
  RESOURCE_WEIGHTS,
  RESOURCE_CATEGORY_1,
  RESOURCE_CATEGORY_2,
  RESOURCE_CATEGORY_3,
  RESOURCE_CATEGORY_4,
} = require("./constants.js");

const realmWheatAmount =
  AVERAGE_DAILY_AMOUNT_OF_WHEAT_PRODUCTION *
  NUMBER_OF_DAYS_OF_WOOD_PRODUCTION *
  FOOD_COEFFICIENT *
  1000;

// amount of fish to first level up a realm
const realmFishAmount =
  AVERAGE_DAILY_AMOUNT_OF_FISH_PRODUCTION *
  NUMBER_OF_DAYS_OF_WOOD_PRODUCTION *
  FOOD_COEFFICIENT *
  1000;

const getResourceAmount = (resources, multiplier) => {
  let amounts = [];

  const baseAmount =
    NUMBER_OF_DAYS_OF_WOOD_PRODUCTION * 24 * PRODUCTION_PER_HOUR;

  for (const resourceId of resources) {
    const resourceWeight =
      RESOURCE_WEIGHTS[resourceId - 1][1] / RESOURCE_WEIGHTS[0][1];
    amounts.push([
      resourceId,
      Math.round(baseAmount * resourceWeight * multiplier * 1000),
    ]);
  }
  return amounts;
};

const formatResources = (resourceAmounts) => {
  let resources = `${resourceAmounts.length}`;
  for (const resource of resourceAmounts) {
    const resourceId = resource[0];
    const amount = resource[1];
    resources += `,${resourceId},${amount}`;
  }
  return resources;
};

const category_1 = getResourceAmount(RESOURCE_CATEGORY_1, 1).concat([
  [254, realmWheatAmount],
  [255, realmFishAmount],
]);

console.log({ category_1: formatResources(category_1) });

const category_2 = getResourceAmount(RESOURCE_CATEGORY_2, 1).concat([
  [254, realmWheatAmount],
  [255, realmFishAmount],
]);

console.log({ category_2: formatResources(category_2) });

const category_3 = getResourceAmount(RESOURCE_CATEGORY_3, 1).concat([
  [254, realmWheatAmount],
  [255, realmFishAmount],
]);

console.log({ category_3: formatResources(category_3) });

const category_4 = getResourceAmount(RESOURCE_CATEGORY_4, 1).concat([
  [254, realmWheatAmount],
  [255, realmFishAmount],
]);

console.log({ category_4: formatResources(category_4) });
