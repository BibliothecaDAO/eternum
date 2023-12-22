// multiplier = 1 for single realm
// multiplier > 1 for hyperstructure leveling depending on the difficulty
const multiplier = 1;

let resourcesProbs = [
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

// 11h => 12h = 132 wood as base prod for level up, then the rest depends on probability compared to wood
let base_cost = 132;

resource_tier_1 = [1, 2, 3, 4, 5, 6, 7];
resource_tier_2 = [8, 9, 10, 11, 12, 13, 14, 15];
resource_tier_3 = [16, 17, 18, 19, 20, 21, 22];

const getResourceAmount = (resources) => {
  let amounts = "";

  for (const resourceId of resources) {
    added = `,${resourceId},${Math.round(
      (multiplier * base_cost * 1000 * resourcesProbs[resourceId - 1][1]) /
        resourcesProbs[0][1]
    )}`;
    amounts += added;
  }
  return `${resources.length}${amounts}`;
};

console.log(`\n\n ${getResourceAmount(resource_tier_1)}\n\n`);
console.log(`\n\n ${getResourceAmount(resource_tier_2)}\n\n`);
console.log(`\n\n ${getResourceAmount(resource_tier_3)}\n\n`);
