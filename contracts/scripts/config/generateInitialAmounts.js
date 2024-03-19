const { INITIAL_FOOD_COEFFICIENT, MAXIMUM_REALMS_LEVEL, RESOURCE_IDS } = require("./constants.js");

const { getResourceAmount, realmFishAmount, realmWheatAmount } = require("./generateLevelingCommands.js");

// realms should be able to level up to first level when settled

const resourceLevelingAmounts = getResourceAmount(RESOURCE_IDS, 1);

let resourcesProd = resourceLevelingAmounts.flatMap((resource) => {
  return [resource[0], Math.round(resource[1] / MAXIMUM_REALMS_LEVEL)];
});

resourcesProd = resourcesProd += [
  ,
  254,
  Math.round(realmWheatAmount * INITIAL_FOOD_COEFFICIENT),
  255,
  Math.round(realmFishAmount * INITIAL_FOOD_COEFFICIENT),
];

let resourcesDev = Array.from({ length: 22 }, (_, i) => [i + 1, 1000000000]);
resourcesDev = resourcesDev += [, 253, 1000000000, 254, 1000000000, 255, 1000000000];

let commandProd = `"sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,24,${resourcesProd}"`;
console.log("\n");
console.log(commandProd);
console.log("\n");

let commandDev = `"sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,25,${resourcesDev}"`;
console.log("\n");
console.log(commandDev);
console.log("\n");
