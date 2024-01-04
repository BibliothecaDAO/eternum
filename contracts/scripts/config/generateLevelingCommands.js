const {
  FOOD_COEFFICIENT,
  NUMBER_OF_REALMS_PER_PLAYER,
  MINIMUM_NUMBER_OF_PLAYERS,
  NUMBER_OF_DAYS_OF_WOOD_PRODUCTION,
  AVERAGE_DAILY_AMOUNT_OF_FISH_PRODUCTION,
  AVERAGE_DAILY_AMOUNT_OF_WHEAT_PRODUCTION,
  RESOURCE_WEIGHTS,
  PRODUCTION_PER_HOUR,
  RESOURCE_TIER_1,
  RESOURCE_TIER_2,
  RESOURCE_TIER_3,
} = require("./constants.js");

/**
 *
 * @param {*} resources
 * @param {*} multiplier in case of hyperstructure leveling, multiplies amounts
 * @returns
 */
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

// convert to string and add commas
const formatResources = (resourceAmounts) => {
  let resources = `${resourceAmounts.length}`;
  for (const resource of resourceAmounts) {
    const resourceId = resource[0];
    const amount = resource[1];
    resources += `,${resourceId},${amount}`;
  }
  return resources;
};

// amount of wheat to first level up a realm
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

function myMain() {
  // REALMS
  // console.log(
  //   `\n Resource Tier 1: ${formatResources(
  //     getResourceAmount(RESOURCE_TIER_1, 1)
  //   )}\n`
  // );
  // console.log(
  //   `\n Resource Tier 2: ${formatResources(
  //     getResourceAmount(RESOURCE_TIER_2, 1)
  //   )}\n`
  // );
  // console.log(
  //   `\n Resource Tier 3: ${formatResources(
  //     getResourceAmount(RESOURCE_TIER_3, 1)
  //   )}\n`
  // );

  console.log(`\n Realm Wheat Amount: ${realmWheatAmount}\n`);
  console.log(`\n Fish Wheat Amount: ${realmFishAmount}\n`);

  // REALMS
  console.log(
    `\n"sozo execute $CONFIG_SYSTEMS set_leveling_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,999999999999999993,604800,1000,1844674407370955161,4611686018427387904,25,${realmWheatAmount},${realmFishAmount},${formatResources(
      getResourceAmount(RESOURCE_TIER_1, 1)
    )},${formatResources(
      getResourceAmount(RESOURCE_TIER_2, 1)
    )},${formatResources(getResourceAmount(RESOURCE_TIER_3, 1))}"\n`
  );

  const hyperstructureMuliplier =
    MINIMUM_NUMBER_OF_PLAYERS * NUMBER_OF_REALMS_PER_PLAYER;

  // HYPERSTRUCTURES
  console.log(
    `\n"sozo execute $CONFIG_SYSTEMS set_leveling_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,999999999999999992,604800,4,1844674407370955161,4611686018427387904,25,${
      hyperstructureMuliplier * realmWheatAmount
    },${hyperstructureMuliplier * realmFishAmount},${formatResources(
      getResourceAmount(RESOURCE_TIER_1, hyperstructureMuliplier)
    )},${formatResources(
      getResourceAmount(RESOURCE_TIER_2, hyperstructureMuliplier)
    )},${formatResources(
      getResourceAmount(RESOURCE_TIER_3, hyperstructureMuliplier)
    )}"\n`
  );
}

if (require.main === module) {
  myMain();
}

module.exports = {
  getResourceAmount,
  realmFishAmount,
  realmWheatAmount,
};
